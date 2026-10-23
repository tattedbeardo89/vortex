// Explicitly development-only transport. Never imported by the PS5 bundle.
import http from "node:http";
import { randomBytes } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  existsSync,
  renameSync,
  openSync,
  fsyncSync,
  closeSync,
} from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";
import { deviceStorage } from "../security/storage.js";
import { createAuth } from "../security/auth.js";
import { createRouter } from "./router.js";
import { createStateAdapter } from "../integration/state-adapter.js";
const root = fileURLToPath(new URL("../../../../", import.meta.url));
const app = `${root}.vortex/vortex`;
process.env.CATALOG_APP_ROOT = app;
process.env.CATALOG_REACT_PATH = `${root}ps5-react/node_modules/react/index.js`;
process.env.CATALOG_HOMEBREW_FILE = `${root}custom/vortex/tests/fixtures/homebrew-index.json`;
register(
  pathToFileURL(`${root}tools/catalog-diagnostics/loader.mjs`),
  import.meta.url,
);
const catalog = await import(pathToFileURL(`${app}/state/catalog.js`));
const homebrew = await import(pathToFileURL(`${app}/state/homebrew.js`));
const baseline = JSON.parse(
  readFileSync(`${root}custom/vortex/upstream-baseline.json`),
);
const brand = JSON.parse(readFileSync(`${root}custom/vortex/brand.json`));
const port = Number(process.env.VORTEX_WEB_DEV_PORT || 34189);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid development port");
const auth = createAuth({
  random: (count) => randomBytes(count).toString("hex"),
  port: () => port,
  storage: deviceStorage(
    {
      exists: existsSync,
      readFile: (p) => readFileSync(p, "utf8"),
      mkdir: (p) => mkdirSync(p, { recursive: true }),
      writeFile: (p, value) => {
        const fd = openSync(p, "w", 0o600);
        try {
          writeFileSync(fd, value);
          fsyncSync(fd);
        } finally {
          closeSync(fd);
        }
      },
      rename: renameSync,
    },
    process.env.VORTEX_WEB_DEV_STATE ||
      (process.env.VORTEX_WEB_DEV_CONSOLE
        ? process.env.VORTEX_WEB_DEV_CONSOLE + ".devices"
        : `${root}.vortex/dev-web-devices`),
  ),
});
let favorites = [];
const state = createStateAdapter({
  catalog,
  homebrew: {
    ...homebrew,
    refresh: async () => {},
    loadDetails: async () => {},
  },
  queue: () => ({ snapshot: () => [] }),
  roots: () => [],
  usage: () => ({ total: null, free: null }),
  driveName: () => "",
  wishlist: () => favorites,
  setFavorite: (id, wished) => {
    favorites = wished
      ? [...new Set([...favorites, id])]
      : favorites.filter((x) => x !== id);
  },
  version: brand.version,
  baseline: {
    sourceVersion: baseline.sourceVersion,
    commit: baseline.commit,
    catalogRevision: baseline.catalog.dataRevision,
  },
  development: true,
});
const router = createRouter({
  auth,
  state,
  settings: () => ({ port, binding: "127.0.0.1", readOnly: false }),
  readAsset: (name) => readFileSync(`${app}/vortex-web-assets/${name}`, "utf8"),
});
const server = http.createServer(
  { maxHeaderSize: 8192, requestTimeout: 10000, headersTimeout: 10000 },
  async (req, res) => {
    const pairs = new Set();
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const key = req.rawHeaders[i].toLowerCase();
      if (pairs.has(key)) {
        res.writeHead(400);
        res.end();
        return;
      }
      pairs.add(key);
    }
    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk.toString("utf8");
        if (Buffer.byteLength(body) > 16384) {
          res.writeHead(413);
          res.end();
          return;
        }
      }
      const request = {
        method: req.method,
        target: req.url,
        peer: req.socket.remoteAddress.replace(/^::ffff:/, ""),
        local: req.socket.localAddress.replace(/^::ffff:/, ""),
        headers: req.headers,
        body,
      };
      const result = await router(request);
      res.writeHead(result.status, {
        "Content-Type": result.type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
        ...(result.cookie ? { "Set-Cookie": result.cookie } : {}),
      });
      res.end(result.body);
    } catch {
      // An interrupted development request must not crash the server.
      res.destroy();
    }
  },
);
server.maxConnections = 16;
server.listen(port, "127.0.0.1", () => {
  const pairing = auth.newCode();
  mkdirSync(`${root}.vortex`, { recursive: true });
  const consoleFile =
    process.env.VORTEX_WEB_DEV_CONSOLE || `${root}.vortex/web-dev-console.json`;
  writeFileSync(consoleFile, JSON.stringify(pairing), { mode: 0o600 });
  console.log(
    `Vortex Web DEVELOPMENT: http://127.0.0.1:${port}. Pairing code is in the private development console file; no console transfers are supported.`,
  );
});
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    rmSync(
      process.env.VORTEX_WEB_DEV_CONSOLE ||
        `${root}.vortex/web-dev-console.json`,
      { force: true },
    );
    auth.flush();
    server.close(() => process.exit(0));
    server.closeAllConnections();
  });
