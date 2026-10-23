import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { sha256 } from "../security/sha256.js";
import { createAuth, SESSION_MS, ACTIVITY_WRITE_MS } from "../security/auth.js";
import { deviceStorage } from "../security/storage.js";
import { createRouter } from "../backend/router.js";
const req = (
  cookie = "",
  method = "GET",
  path = "/api/v1/status",
  csrf = "",
  body = {},
) => ({
  method,
  target: path,
  peer: "127.0.0.1",
  local: "127.0.0.1",
  headers: {
    host: "127.0.0.1:34189",
    origin: "http://127.0.0.1:34189",
    cookie,
    "content-type": "application/json",
    "x-vortex-csrf": csrf,
  },
  body: method === "GET" ? "" : JSON.stringify(body),
});
function fixture() {
  let clock = 1700000000000,
    files = new Map(),
    writes = 0,
    broken = false;
  const fs = {
    exists: (p) => files.has(p),
    readFile: (p) => files.get(p),
    mkdir: () => {},
    writeFile: (p, v) => {
      if (broken) throw Error("disk full");
      writes++;
      files.set(p, v);
    },
    rename: (a, b) => {
      files.set(b, files.get(a));
      files.delete(a);
    },
  };
  const store = deviceStorage(fs, "/data/vortex");
  const start = () =>
    createAuth({
      random: (n) => randomBytes(n).toString("hex"),
      now: () => clock,
      storage: store,
    });
  const pair = (a) => {
    const p = a.pair(req(), { code: a.newCode().code });
    return {
      cookie: p.cookie.split(";")[0],
      csrf: p.session.csrf,
      id: p.session.id,
    };
  };
  return {
    start,
    pair,
    files,
    store,
    advance: (n) => (clock += n),
    set: (n) => (clock = n),
    writes: () => writes,
    fail: () => (broken = true),
  };
}
test("portable token verifier matches independent SHA-256 vectors", () => {
  for (const text of [
    "",
    "abc",
    "a".repeat(1000),
    "0123456789abcdef".repeat(4) + ":csrf",
  ])
    assert.equal(sha256(text), createHash("sha256").update(text).digest("hex"));
});
test("pairing persists across service/process reconstruction without plaintext bearer or CSRF secrets", () => {
  const f = fixture(),
    a = f.start(),
    p = f.pair(a);
  a.flush();
  const saved = f.files.get("/data/vortex/web-devices.json");
  assert.ok(!saved.includes(p.cookie.split("=")[1]));
  assert.ok(!saved.includes(p.csrf));
  assert.equal(f.start().authenticate(req(p.cookie)).id, p.id);
  assert.equal(f.start().authenticate(req(p.cookie)).csrf, p.csrf);
});
test("30-day inactivity expires; authenticated user activity slides it while read-only polling does not", async () => {
  const f = fixture(),
    a = f.start(),
    p = f.pair(a);
  const router = createRouter({
    auth: a,
    state: { status: () => ({ ok: true }), downloads: () => ({ items: [] }) },
    settings: () => ({ readOnly: false }),
    readAsset: () => "",
  });
  f.advance(SESSION_MS - 1000);
  assert.equal((await router(req(p.cookie))).status, 200);
  assert.equal(
    (await router(req(p.cookie, "GET", "/api/v1/downloads"))).status,
    200,
  );
  f.advance(1001);
  assert.equal((await router(req(p.cookie))).status, 401);
  const q = f.pair(a);
  f.advance(SESSION_MS - 1000);
  assert.equal(
    (await router(req(q.cookie, "POST", "/api/v1/auth/activity", q.csrf)))
      .status,
    200,
  );
  f.advance(2000);
  assert.equal(f.start().authenticate(req(q.cookie)).id, q.id);
  f.advance(SESSION_MS);
  assert.throws(() => f.start().authenticate(req(q.cookie)), /expired/);
});
test("rejected CSRF, unauthorized probes and failed operations never renew activity", async () => {
  const f = fixture(),
    a = f.start(),
    p = f.pair(a);
  const router = createRouter({
    auth: a,
    state: {
      favorite: () => {
        throw Error("failed");
      },
    },
    settings: () => ({}),
    readAsset: () => "",
  });
  const initial = a.devices()[0].expires;
  f.advance(ACTIVITY_WRITE_MS + 1);
  assert.equal(
    (await router(req(p.cookie, "POST", "/api/v1/auth/activity", "wrong")))
      .status,
    403,
  );
  assert.equal((await router(req(""))).status, 401);
  assert.equal(
    (await router(req(p.cookie, "POST", "/api/v1/favorites", p.csrf))).status,
    500,
  );
  assert.equal(a.devices()[0].expires, initial);
});
test("activity writes are throttled, graceful stop flushes, and durable revocation survives restart", () => {
  const f = fixture(),
    a = f.start(),
    p = f.pair(a),
    writes = f.writes();
  f.advance(1000);
  a.touch(p.id);
  a.touch(p.id);
  assert.equal(f.writes(), writes);
  a.flush();
  assert.equal(f.writes(), writes + 1);
  a.revoke(p.id);
  assert.throws(() => f.start().authenticate(req(p.cookie)), /revoked/);
});
test("corrupt/oversized/future/duplicate records and invalid clocks fail closed", () => {
  for (const value of ["{", JSON.stringify({ format: 2 }), "x".repeat(32769)]) {
    const f = fixture();
    f.files.set("/data/vortex/web-devices.json", value);
    assert.throws(f.start);
  }
  const f = fixture(),
    a = f.start(),
    p = f.pair(a);
  f.set(1);
  assert.throws(f.start, /clock/);
  assert.throws(() => a.authenticate(req(p.cookie)), /clock/);
  const g = fixture(),
    b = g.start();
  g.pair(b);
  const row = JSON.parse(g.files.get("/data/vortex/web-devices.json"));
  row.devices.push(row.devices[0]);
  g.files.set("/data/vortex/web-devices.json", JSON.stringify(row));
  assert.throws(g.start, /Invalid saved/);
});
test("interrupted temporary writes retain committed state, never resurrect a revoked device, and failed pairing is not acknowledged", () => {
  const f = fixture(),
    a = f.start(),
    p = f.pair(a);
  const old = f.files.get("/data/vortex/web-devices.json");
  a.revoke(p.id);
  f.files.set("/data/vortex/web-devices.json.tmp", old);
  assert.throws(() => f.start().authenticate(req(p.cookie)), /revoked/);
  const g = fixture();
  g.files.set("/data/vortex/web-devices.json.tmp", old);
  assert.throws(g.start, /Interrupted/);
  const h = fixture(),
    b = h.start();
  h.fail();
  assert.throws(() => h.pair(b), /could not be saved/);
  assert.equal(b.devices().length, 0);
});
test("session bound is retained across persistent reconstruction", () => {
  const f = fixture();
  let a = f.start();
  for (let i = 0; i < 16; i++) {
    f.pair(a);
    f.advance(60001);
  }
  a = f.start();
  assert.throws(() => f.pair(a), /Revoke/);
});
