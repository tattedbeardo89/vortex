import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createAuth, privateIPv4, SESSION_MS } from "../security/auth.js";
import { createRouter } from "../backend/router.js";
const request = (
  method = "GET",
  target = "/api/v1/status",
  headers = {},
  body = "",
) => ({
  method,
  target,
  peer: "127.0.0.1",
  local: "127.0.0.1",
  headers: {
    host: "127.0.0.1:34189",
    ...(method === "GET"
      ? {}
      : {
          origin: "http://127.0.0.1:34189",
          "content-type": "application/json",
        }),
    ...headers,
  },
  body,
});
function setup() {
  let clock = 1000;
  const auth = createAuth({
    random: (n) => randomBytes(n).toString("hex"),
    now: () => clock,
  });
  let writes = 0;
  let readOnly = false;
  const router = createRouter({
    auth,
    state: {
      status: () => ({ name: "Vortex" }),
      favorite: () => {
        writes++;
        return { ok: true };
      },
    },
    settings: () => ({ readOnly }),
    readAsset: (name) => `asset ${name}`,
  });
  return {
    auth,
    router,
    clock: (n) => (clock = n),
    writes: () => writes,
    readonly: () => (readOnly = true),
  };
}
async function pair(s) {
  const code = s.auth.newCode().code;
  const result = await s.router(
    request(
      "POST",
      "/api/v1/auth/pair",
      {},
      JSON.stringify({ code, name: "Test browser" }),
    ),
  );
  assert.equal(result.status, 200);
  return {
    cookie: result.cookie.split(";")[0],
    csrf: JSON.parse(result.body).csrf,
    code,
  };
}
const authorized = (p, method, path, body = {}) =>
  request(
    method,
    path,
    { cookie: p.cookie, "x-vortex-csrf": p.csrf },
    method === "GET" ? "" : JSON.stringify(body),
  );
test("all private IPv4 ranges accepted; global, ambiguous and IPv6 addresses refused", () => {
  for (const ip of [
    "10.2.3.4",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.7.9",
    "169.254.4.3",
    "127.0.0.1",
  ])
    assert.ok(privateIPv4(ip));
  for (const ip of [
    "8.8.8.8",
    "172.32.0.1",
    "192.169.0.1",
    "::1",
    "127.0.0.01",
    "10.0.0.999",
    "hostname",
  ])
    assert.equal(privateIPv4(ip), false);
});
test("static shell is public; every sensitive endpoint requires authentication", async () => {
  const s = setup();
  assert.equal((await s.router(request("GET", "/"))).status, 200);
  for (const target of [
    "status",
    "catalog",
    "game?id=PPSA01500",
    "homebrew",
    "favorites",
    "downloads",
    "storage",
    "settings",
    "dashboard",
    "facets",
  ])
    assert.equal(
      (await s.router(request("GET", "/api/v1/" + target))).status,
      401,
    );
});
test("one-time pairing, HttpOnly SameSite cookie, CSRF and revocation work", async () => {
  const s = setup(),
    p = await pair(s);
  assert.match(p.cookie, /^vortex_session=[a-f0-9]{64}$/);
  assert.equal(
    (
      await s.router(
        request(
          "POST",
          "/api/v1/auth/pair",
          {},
          JSON.stringify({ code: p.code }),
        ),
      )
    ).status,
    401,
  );
  assert.equal(
    (await s.router(authorized(p, "GET", "/api/v1/status"))).status,
    200,
  );
  assert.equal(
    (
      await s.router(
        request("POST", "/api/v1/favorites", { cookie: p.cookie }, "{}"),
      )
    ).status,
    403,
  );
  assert.equal(
    (await s.router(authorized(p, "POST", "/api/v1/favorites"))).status,
    200,
  );
  assert.equal(s.writes(), 1);
  const id = s.auth.devices()[0].id;
  s.auth.revoke(id);
  assert.equal(
    (await s.router(authorized(p, "GET", "/api/v1/status"))).status,
    401,
  );
});
test("session expiry and application shutdown invalidate credentials", async () => {
  const s = setup(),
    p = await pair(s);
  s.clock(1000 + SESSION_MS + 1);
  assert.equal(
    (await s.router(authorized(p, "GET", "/api/v1/status"))).status,
    401,
  );
  const next = await pair(s);
  s.auth.clear();
  assert.equal(
    (await s.router(authorized(next, "GET", "/api/v1/status"))).status,
    401,
  );
});
test("Origin, DNS rebinding, remote peers, content types and request limits fail closed", async () => {
  const s = setup(),
    p = await pair(s);
  for (const change of [
    { headers: { host: "evil.test:34189" } },
    { headers: { origin: "http://evil.test" } },
    { headers: { "sec-fetch-site": "cross-site" } },
    { peer: "203.0.113.8" },
    { local: "8.8.8.8" },
  ]) {
    const req = authorized(p, "POST", "/api/v1/favorites");
    Object.assign(req, {
      ...change,
      headers: { ...req.headers, ...change.headers },
    });
    assert.equal((await s.router(req)).status, 403);
  }
  assert.equal(
    (
      await s.router(
        request(
          "POST",
          "/api/v1/auth/pair",
          { "content-type": "text/plain" },
          "{}",
        ),
      )
    ).status,
    415,
  );
  assert.equal(
    (await s.router(request("POST", "/api/v1/auth/pair", {}, "["))).status,
    400,
  );
  assert.equal(
    (
      await s.router(
        request("POST", "/api/v1/auth/pair", {}, "x".repeat(16385)),
      )
    ).status,
    413,
  );
  assert.equal(s.writes(), 0);
});
test("pairing attempts are limited and stale codes expire", async () => {
  const s = setup();
  const code = s.auth.newCode().code;
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await s.router(
          request("POST", "/api/v1/auth/pair", {}, '{"code":"wrong"}'),
        )
      ).status,
      401,
    );
  assert.equal(
    (
      await s.router(
        request("POST", "/api/v1/auth/pair", {}, JSON.stringify({ code })),
      )
    ).status,
    429,
  );
  s.clock(1000 + 5 * 60000 + 1);
  assert.equal(
    (
      await s.router(
        request("POST", "/api/v1/auth/pair", {}, JSON.stringify({ code })),
      )
    ).status,
    401,
  );
});
test("read-only mode blocks writes but permits authenticated reads and sign-out", async () => {
  const s = setup(),
    p = await pair(s);
  s.readonly();
  assert.equal(
    (await s.router(authorized(p, "POST", "/api/v1/favorites"))).status,
    403,
  );
  assert.equal(
    (await s.router(authorized(p, "GET", "/api/v1/status"))).status,
    200,
  );
  assert.equal(
    (await s.router(authorized(p, "POST", "/api/v1/auth/logout"))).status,
    200,
  );
  assert.equal(s.writes(), 0);
});
test("multiple paired browsers share state and targeted revocation is isolated", async () => {
  const s = setup(),
    one = await pair(s),
    two = await pair(s);
  assert.notEqual(one.cookie, two.cookie);
  const first = s.auth.devices()[0].id;
  s.auth.revoke(first);
  assert.equal(
    (await s.router(authorized(one, "GET", "/api/v1/status"))).status,
    401,
  );
  assert.equal(
    (await s.router(authorized(two, "GET", "/api/v1/status"))).status,
    200,
  );
});
test("weak or missing randomness is never accepted", () => {
  for (const random of [
    () => "",
    () => "0".repeat(4),
    () => {
      throw new Error("unavailable");
    },
  ])
    assert.throws(() => createAuth({ random }).newCode());
});
test("revoking a session during asynchronous resolution prevents enqueue", async () => {
  const auth = createAuth({ random: (n) => randomBytes(n).toString("hex") });
  let release, entered;
  const pending = new Promise((r) => {
    release = r;
  });
  const started = new Promise((r) => {
    entered = r;
  });
  let writes = 0;
  const router = createRouter({
    auth,
    settings: () => ({ readOnly: false }),
    readAsset: () => "",
    state: {
      enqueue: async (_body, authorize) => {
        entered();
        await pending;
        authorize();
        writes++;
        return { id: "job" };
      },
    },
  });
  const s = { auth, router };
  const credentials = await pair(s);
  const response = router(
    authorized(credentials, "POST", "/api/v1/downloads", {}),
  );
  await started;
  auth.revoke(auth.devices()[0].id);
  release();
  assert.equal((await response).status, 401);
  assert.equal(writes, 0);
});
