import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  storageLocation,
  prepareStorage,
  probeStorage,
} from "../security/location.js";
import { deviceStorage } from "../security/storage.js";
import { createAuth, SESSION_MS } from "../security/auth.js";
import { register } from "node:module";
register(new URL("./service-loader.mjs", import.meta.url), import.meta.url);
const { refreshArtwork, restoreArtwork, inspectArtwork } = await import(
  "../integration/artwork.js"
);
const { BUILD } = await import("../../../../.vortex/vortex/vortex-build.js");
function fixture() {
  const files = new Map(),
    modes = new Map(),
    writes = [];
  return {
    files,
    modes,
    writes,
    dataDir: "/download0",
    exists: (p) => files.has(p),
    readFile: (p) => {
      if (!files.has(p)) throw Error("missing");
      return files.get(p);
    },
    mkdir: () => {},
    chmod: (p, m) => modes.set(p, m),
    writeFile: (p, v) => {
      writes.push(p);
      files.set(p, v);
    },
    rename: (a, b) => {
      files.set(b, files.get(a));
      files.delete(a);
    },
    remove: (p) => files.delete(p),
    copyFile: (a, b) => {
      if (!files.has(a)) throw Error("missing");
      writes.push(b);
      files.set(b, files.get(a));
    },
  };
}
const req = (cookie) => ({
  method: "GET",
  target: "/api/v1/status",
  peer: "127.0.0.1",
  local: "127.0.0.1",
  headers: {
    host: "127.0.0.1:34189",
    origin: "http://127.0.0.1:34189",
    cookie,
  },
});
test("PS5 pairing survives replacement of the entire download0 image and process reconstruction, then revocation persists", () => {
  const fs = fixture(),
    dir = storageLocation(fs, "ps5");
  assert.equal(dir, "/data/vortex/PPSA99189/web");
  assert.notEqual(dir, storageLocation(fs, "desktop"));
  let now = 1700000000000;
  const start = () =>
    createAuth({
      random: (n) => randomBytes(n).toString("hex"),
      now: () => now,
      storage: deviceStorage(fs, dir),
    });
  assert.equal(prepareStorage(fs, dir, "/download0/vortex").writable, true);
  let auth = start();
  const paired = auth.pair(req(""), { code: auth.newCode().code });
  const cookie = paired.cookie.split(";")[0];
  auth.close();
  for (const key of fs.files.keys())
    if (key.startsWith("/download0/")) fs.files.delete(key);
  now += 24 * 60 * 60 * 1000;
  auth = start();
  assert.equal(auth.authenticate(req(cookie)).id, paired.session.id);
  assert.equal(fs.modes.get(dir), 0o700);
  assert.equal(fs.modes.get(dir + "/web-devices.json.tmp"), 0o600);
  auth.revoke(paired.session.id);
  auth.close();
  assert.throws(() => start().authenticate(req(cookie)), /revoked/);
});
test("one-time migration never resurrects older authorization after durable revocation or remount", () => {
  const fs = fixture(),
    dir = storageLocation(fs, "ps5"),
    legacy = "/download0/vortex";
  const old = { format: 1, highWater: 1700000000000, devices: [] };
  fs.files.set(legacy + "/web-devices.json", JSON.stringify(old));
  prepareStorage(fs, dir, legacy);
  fs.files.set(
    dir + "/web-devices.json",
    JSON.stringify({ ...old, highWater: 1700000001000 }),
  );
  prepareStorage(fs, dir, legacy);
  assert.equal(
    JSON.parse(fs.files.get(dir + "/web-devices.json")).highWater,
    1700000001000,
  );
  fs.files.delete(dir + "/web-devices.json");
  prepareStorage(fs, dir, legacy);
  assert.equal(fs.files.has(dir + "/web-devices.json"), false);
  assert.equal(
    [...fs.files.keys()].some((k) => k.includes(".storage-probe")),
    false,
  );
});
test("durable storage probe reports failure without reading or returning device records", () => {
  const fs = fixture();
  fs.writeFile = () => {
    throw Error("disk full token-secret");
  };
  const result = probeStorage(fs, "/data/vortex/PPSA99189/web");
  assert.equal(result.writable, false);
  assert.equal(JSON.stringify(result).includes("token-secret"), false);
  assert.equal(result.hardwareDurabilityVerified, false);
});
test("registered artwork refresh is title-bound, backed up, and never removes user data", () => {
  const fs = fixture(),
    root = "/user/appmeta/PPSA99189";
  const param = JSON.stringify({
    titleId: "PPSA99189",
    contentId: "UP9000-PPSA99189_00-VORTEXPS50000000",
  });
  fs.files.set("/app0/sce_sys/param.json", param);
  fs.files.set(root + "/param.json", param);
  fs.files.set("/user/app/PPSA99189/sce_sys/param.json", param);
  fs.files.set("/user/app/PPSA99189/icon0.png", "Old staged root icon");
  for (const name of ["icon0.png", "pic0.dds", "pic1.dds"]) {
    fs.files.set("/app0/sce_sys/" + name, "Angular V " + name);
    fs.files.set(root + "/" + name, "Old " + name);
    fs.files.set("/user/app/PPSA99189/sce_sys/" + name, "Old staged " + name);
  }
  fs.files.set("/data/vortex/PPSA99189/web/web-devices.json", "untouched");
  assert.throws(() => refreshArtwork(fs, "desktop"), /only on PS5/);
  assert.equal(fs.writes.length, 0);
  const hash = (_location, name) => BUILD.artwork["sce_sys/" + name].sha256;
  assert.throws(() => refreshArtwork(fs, "ps5", () => "wrong"), /not verified/);
  assert.equal(fs.writes.length, 0);
  refreshArtwork(fs, "ps5", hash);
  for (const name of ["icon0.png", "pic0.dds", "pic1.dds"]) {
    assert.equal(fs.files.get(root + "/" + name), "Angular V " + name);
    assert.equal(
      fs.files.get("/data/vortex/PPSA99189/artwork-backup/" + name),
      "Old " + name,
    );
  }
  assert.equal(
    fs.files.get("/data/vortex/PPSA99189/web/web-devices.json"),
    "untouched",
  );
  assert.equal(
    fs.files.get("/data/vortex/PPSA99189/artwork-backup/param.json"),
    param,
  );
  assert.equal(
    fs.files.get("/user/app/PPSA99189/icon0.png"),
    "Angular V icon0.png",
  );
  restoreArtwork(fs, "ps5");
  assert.equal(
    fs.files.get("/user/app/PPSA99189/icon0.png"),
    "Old staged root icon",
  );
  assert.equal(fs.files.get(root + "/icon0.png"), "Old icon0.png");
  fs.files.set(root + "/param.json", JSON.stringify({ titleId: "PPSA99058" }));
  const previous = fs.writes.length;
  assert.throws(() => refreshArtwork(fs, "ps5"), /identity mismatch/);
  assert.equal(fs.writes.length, previous);
});

test("artwork inspection distinguishes compiled metadata, actual mounted hashes and stale registered artwork without writes", () => {
  const fs = fixture();
  fs.files.set(
    "/app0/VORTEX-BRANDING.json",
    JSON.stringify({ masterSha256: BUILD.brandingRevision }),
  );
  const report = inspectArtwork(fs, (where, name) =>
    where === "mounted" ? BUILD.artwork["sce_sys/" + name].sha256 : "old",
  );
  assert.equal(report.compiledRevision, report.mountedRevision);
  assert.equal(report.files["icon0.png"].mountedMatches, true);
  assert.equal(report.files["icon0.png"].registeredMatches, false);
  assert.equal(report.hardwareCacheVerified, false);
  assert.equal(fs.writes.length, 0);
});
