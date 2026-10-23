import { WebError } from "../security/auth.js";
const ASSETS = {
  "/favicon.svg": ["favicon.svg", "image/svg+xml"],
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
};
const safeError = (error) =>
  String(error?.message || "Request failed")
    .replace(/https?:\/\/\S+/g, "[provider address]")
    .slice(0, 500);
export function createRouter({ auth, state, settings, readAsset }) {
  return async (req) => {
    let session;
    const json = (status, body, cookie = "") => {
      if (
        status >= 200 &&
        status < 300 &&
        session &&
        req.method === "POST" &&
        !req.target.startsWith("/api/v1/auth/logout")
      ) {
        auth.touch(session.id);
        cookie = cookie || auth.renewal(req);
      }
      const text = JSON.stringify(body);
      return text.length > 512 * 1024
        ? {
            status: 413,
            type: "application/json",
            body: '{"error":"Response too large; narrow this request"}',
            cookie: "",
          }
        : {
            status,
            type: "application/json; charset=utf-8",
            body: text,
            cookie,
          };
    };
    try {
      auth.validateRequest(req);
      const [path, query = ""] = req.target.split("?");
      if (req.method === "GET" && ASSETS[path]) {
        const [file, type] = ASSETS[path];
        return { status: 200, type, body: readAsset(file), cookie: "" };
      }
      if (!path.startsWith("/api/v1/"))
        throw new WebError(404, "Unknown endpoint");
      let body = {};
      if (req.method !== "GET") {
        if (req.headers["content-type"]?.split(";")[0] !== "application/json")
          throw new WebError(415, "JSON required");
        try {
          body = JSON.parse(req.body || "{}");
        } catch {
          throw new WebError(400, "Invalid JSON");
        }
        if (!body || Array.isArray(body) || typeof body !== "object")
          throw new WebError(400, "JSON object required");
      }
      if (path === "/api/v1/auth/pair" && req.method === "POST") {
        const { session, cookie } = auth.pair(req, body);
        return json(
          200,
          { apiVersion: 1, csrf: session.csrf, expires: session.expires },
          cookie,
        );
      }
      session = auth.authenticate(req);
      if (
        req.method !== "GET" &&
        settings().readOnly &&
        !(
          ["/api/v1/auth/logout", "/api/v1/auth/activity"].includes(path) &&
          req.method === "POST"
        )
      )
        throw new WebError(403, "Vortex Web is read-only");
      if (path === "/api/v1/auth/activity" && req.method === "POST")
        return json(200, { ok: true });
      if (path === "/api/v1/auth/session" && req.method === "GET")
        return json(200, {
          apiVersion: 1,
          csrf: session.csrf,
          expires: session.expires,
          readOnly: settings().readOnly,
        });
      if (path === "/api/v1/auth/logout" && req.method === "POST") {
        auth.revoke(session.id);
        return json(
          200,
          { ok: true },
          "vortex_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
      }
      if (path === "/api/v1/status" && req.method === "GET")
        return json(200, await state.status());
      if (path === "/api/v1/dashboard" && req.method === "GET")
        return json(200, await state.dashboard());
      if (path === "/api/v1/catalog" && req.method === "GET")
        return json(200, await state.catalog(query));
      if (path === "/api/v1/facets" && req.method === "GET")
        return json(200, state.facets());
      if (path === "/api/v1/homebrew" && req.method === "GET")
        return json(200, await state.homebrew(query));
      if (path === "/api/v1/game" && req.method === "GET")
        return json(200, await state.details(query));
      if (path === "/api/v1/favorites" && req.method === "GET")
        return json(200, state.favorites());
      if (path === "/api/v1/favorites" && req.method === "POST")
        return json(200, state.favorite(body));
      if (path === "/api/v1/downloads" && req.method === "GET")
        return json(200, state.downloads());
      if (path === "/api/v1/downloads" && req.method === "POST")
        return json(
          202,
          await state.enqueue(body, () => {
            auth.authenticate(req);
            if (settings().readOnly)
              throw new WebError(403, "Vortex Web is read-only");
          }),
        );
      if (path === "/api/v1/downloads/action" && req.method === "POST")
        return json(200, await state.command(body));
      if (path === "/api/v1/storage" && req.method === "GET")
        return json(200, state.storage());
      if (path === "/api/v1/settings" && req.method === "GET")
        return json(200, {
          ...settings(),
          devices: auth.devices(),
          currentDevice: session.id,
          consoleManaged: true,
        });
      if (path === "/api/v1/devices/revoke" && req.method === "POST") {
        if (typeof body.id !== "string")
          throw new WebError(400, "Device id required");
        auth.revoke(body.id);
        if (body.id === session.id) {
          session = undefined;
          return json(
            200,
            { ok: true },
            "vortex_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
          );
        }
        return json(200, { ok: true });
      }
      throw new WebError(404, "Unknown endpoint or method");
    } catch (error) {
      return json(error instanceof WebError ? error.status : 500, {
        error: safeError(error),
        ...(error instanceof WebError &&
        error.status === 401 &&
        !req.target.startsWith("/api/v1/auth/pair")
          ? { code: "PAIRING_REQUIRED" }
          : {}),
      });
    }
  };
}
