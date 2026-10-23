import { FileSystem } from "@ps5-react/core";
import { deviceStorage } from "../security/storage.js";
import { createAuth } from "../security/auth.js";
import { createRouter } from "../backend/router.js";
import { nativeTransport } from "./native.js";
const FILE = `${FileSystem.dataDir}/vortex/web.json`;
const DEFAULT = {
  enabled: false,
  port: 34189,
  binding: "0.0.0.0",
  readOnly: false,
};
const listeners = new Set();
let config = { ...DEFAULT },
  error = "",
  native = null,
  auth = null,
  router = null,
  timer = null,
  port = 0;
let state = null;
let generation = 0;
export function notify() {
  for (const listener of listeners) listener();
}
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function snapshot() {
  return {
    ...config,
    running: Boolean(timer),
    error,
    devices: auth?.devices() || [],
    pairing: auth?.pairing() || null,
  };
}
export function startService(adapter) {
  state = adapter;
  try {
    if (FileSystem.exists(FILE)) {
      const saved = JSON.parse(FileSystem.readFile(FILE));
      if (
        typeof saved.enabled === "boolean" &&
        Number.isInteger(saved.port) &&
        saved.port >= 1024 &&
        saved.port <= 65535 &&
        ["0.0.0.0", "127.0.0.1"].includes(saved.binding) &&
        typeof saved.readOnly === "boolean"
      )
        config = saved;
    }
  } catch {
    error = "Saved web settings could not be loaded; server remains disabled";
    config = { ...DEFAULT };
  }
  if (config.enabled) apply(config, false);
  return stopService;
}
export function stopService() {
  generation++;
  if (timer) clearInterval(timer);
  timer = null;
  native?.stop();
  try { auth?.flush(); } catch (failure) { error = failure.message; }
  auth = null;
  notify();
}
export function apply(next, persist = true) {
  if (
    !Number.isInteger(next.port) ||
    next.port < 1024 ||
    next.port > 65535 ||
    !["0.0.0.0", "127.0.0.1"].includes(next.binding)
  )
    throw new Error("Choose a valid port and binding");
  stopService();
  config = {
    enabled: Boolean(next.enabled),
    port: next.port,
    binding: next.binding,
    readOnly: Boolean(next.readOnly),
  };
  error = "";
  if (config.enabled)
    try {
      native = nativeTransport();
      port = native.start(config.binding, config.port);
      auth = createAuth({
        random: (count) => native.random(count),
        port: () => port,
        storage: deviceStorage(FileSystem, `${FileSystem.dataDir}/vortex`),
      });
      router = createRouter({
        auth,
        state,
        settings: () => ({
          port,
          binding: config.binding,
          readOnly: config.readOnly,
        }),
        readAsset: (file) =>
          FileSystem.readFile(`/app0/vortex-web-assets/${file}`),
      });
      const startedGeneration = generation;
      timer = setInterval(() => {
        try {
          for (const req of native.poll())
            void router(req)
              .then((result) => {
                if (generation !== startedGeneration) return;
                native.reply(
                  req.id,
                  result.status,
                  result.type,
                  result.body,
                  result.cookie,
                );
                notify();
              })
              .catch(() => {
                if (generation !== startedGeneration) return;
                native.reply(
                  req.id,
                  500,
                  "application/json",
                  '{"error":"Request failed"}',
                  "",
                );
              });
        } catch {
          error =
            "Web transport stopped unexpectedly; disable and enable it on the console";
          stopService();
        }
      }, 50);
      auth.newCode();
    } catch (failure) {
      error = failure.message;
      config.enabled = false;
      if (timer) clearInterval(timer);
      timer = null;
      auth = null;
      native?.stop();
    }
  if (persist)
    try {
      FileSystem.mkdir(`${FileSystem.dataDir}/vortex`, { recursive: true });
      FileSystem.writeFile(`${FILE}.tmp`, JSON.stringify(config), {
        sync: true,
      });
      FileSystem.rename(`${FILE}.tmp`, FILE);
    } catch {
      error = "Web settings could not be saved";
    }
  notify();
  return snapshot();
}
export function pairCode() {
  if (!auth || !timer) throw new Error("Enable Vortex Web first");
  auth.newCode();
  notify();
}
export function revoke(id) {
  try { auth?.revoke(id);error=""; } catch(failure) { error=failure.message; }
  notify();
}

// Console-only recovery. Never exposed as an unauthenticated HTTP endpoint.
export function resetDevices() {
  stopService();
  deviceStorage(FileSystem, `${FileSystem.dataDir}/vortex`).save({format:1,highWater:Date.now(),devices:[]});
  return apply(config);
}
