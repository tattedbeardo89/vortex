// Original Vortex Web security policy. No Node/browser dependencies in the PS5 runtime.
import { sha256 } from "./sha256.js";
export const API_VERSION = 1;
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const equal = (a, b) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length)
    return false;
  let n = 0;
  for (let i = 0; i < a.length; i++) n |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return n === 0;
};
export const privateIPv4 = (value) => {
  if (typeof value !== "string" || !/^\d{1,3}(\.\d{1,3}){3}$/.test(value))
    return false;
  const p = value.split(".").map(Number);
  return (
    p.every((n, i) => n <= 255 && String(n) === value.split(".")[i]) &&
    (p[0] === 10 ||
      p[0] === 127 ||
      (p[0] === 192 && p[1] === 168) ||
      (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 169 && p[1] === 254))
  );
};
export class WebError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const ACTIVITY_WRITE_MS = 5 * 60 * 1000;
export function createAuth({ random, now: wallClock = Date.now, port = () => 34189, storage = null }) {
  const sessions = new Map(),
    attempts = new Map(),
    requests = new Map();
  let highWater=0, savedAt=0, dirty=false;
  const now=() => {
    const time=wallClock();
    if (!Number.isSafeInteger(time) || time<0 || time>4102444800000 || time+300000<highWater)
      throw new WebError(503,'Console clock is invalid or moved backwards; correct it before using Web');
    return highWater=Math.max(highWater,time);
  };
  const save=() => {
    try { storage?.save({format:1,highWater:now(),devices:[...sessions].map(([verifier,{id,name,created,lastActivity}])=>({verifier,id,name,created,lastActivity}))}); }
    catch { throw new WebError(503,'Device authorization could not be saved; retry after checking console storage'); }
    savedAt=now();dirty=false;
  };
  if (storage) {
    const value=storage.load();
    if (value!==null) {
      if (value.format!==1 || !Number.isSafeInteger(value.highWater) || value.highWater<0 || !Array.isArray(value.devices) || value.devices.length>16)
        throw new Error('Invalid saved device authorization; reset Web security data');
      highWater=value.highWater;now();
      const ids=new Set();
      for (const row of value.devices) {
        const {verifier,id,name,created,lastActivity}=row;
        if (!/^[a-f0-9]{64}$/.test(verifier) || !/^[a-f0-9]{24}$/.test(id) || ids.has(id) || sessions.has(verifier) || typeof name!=='string' || name.length>60 || !Number.isSafeInteger(created) || created<0 || !Number.isSafeInteger(lastActivity) || lastActivity<created || lastActivity>highWater)
          throw new Error('Invalid saved device authorization; reset Web security data');
        ids.add(id);sessions.set(verifier,{id,name,created,lastActivity,expires:lastActivity+SESSION_MS});
      }
      savedAt=highWater;
    }
  }
  let pairing = null,
    globalAttempts = [],
    globalRequests = [];
  const fail = (status, message) => {
    throw new WebError(status, message);
  };
  const token = (n) => {
    const value = random(n);
    if (
      typeof value !== "string" ||
      !new RegExp(`^[a-f0-9]{${n * 2}}$`).test(value)
    )
      throw new Error("Secure random source failed");
    return value;
  };
  function prune() {
    for (const [key, s] of sessions)
      if (s.expires <= now()) sessions.delete(key);
    for (const map of [attempts, requests])
      for (const [ip, values] of map)
        if (!values.some((t) => t > now() - 60000)) map.delete(ip);
  }
  function validateRequest(req) {
    if (!privateIPv4(req.peer) || !privateIPv4(req.local))
      fail(403, "Local-network access only");
    const host = req.headers.host;
    if (
      host !== `${req.local}:${port()}` &&
      !(req.local === "127.0.0.1" && host === `localhost:${port()}`)
    )
      fail(403, "Host is not this Vortex listener");
    if (
      req.headers["sec-fetch-site"] &&
      !["same-origin", "none"].includes(req.headers["sec-fetch-site"])
    )
      fail(403, "Cross-site requests refused");
    if (req.method !== "GET" && req.headers.origin !== `http://${host}`)
      fail(403, "Same-origin request required");
    if (req.headers.origin && req.headers.origin !== `http://${host}`)
      fail(403, "Origin refused");
    if (typeof req.body !== "string" || req.body.length > 16384)
      fail(413, "Request too large");
    prune();
    globalRequests = globalRequests.filter((t) => t > now() - 60000);
    if (globalRequests.length >= 480)
      fail(429, "Server request budget exceeded");
    globalRequests.push(now());
    if (!requests.has(req.peer) && requests.size >= 128)
      fail(429, "Too many clients");
    const times = (requests.get(req.peer) || []).filter(
      (t) => t > now() - 60000,
    );
    if (times.length >= 180) fail(429, "Request rate exceeded");
    times.push(now());
    requests.set(req.peer, times);
  }
  function newCode() {
    pairing = { code: token(4).toUpperCase(), expires: now() + 5 * 60000 };
    return { ...pairing };
  }
  function pair(req, body) {
    const times = (attempts.get(req.peer) || []).filter(
      (t) => t > now() - 60000,
    );
    globalAttempts = globalAttempts.filter((t) => t > now() - 60000);
    if (times.length >= 5 || globalAttempts.length >= 20)
      fail(429, "Pairing rate exceeded; wait one minute");
    if (attempts.size >= 128 && !attempts.has(req.peer))
      fail(429, "Too many pairing clients");
    times.push(now());
    attempts.set(req.peer, times);
    globalAttempts.push(now());
    if (
      !pairing ||
      pairing.expires <= now() ||
      !equal(String(body.code || "").toUpperCase(), pairing.code)
    )
      fail(401, "Invalid or expired pairing code");
    if (sessions.size >= 16)
      fail(409, "Revoke a paired device before adding another");
    const secret = token(32),
      csrf = sha256(secret+":csrf"),
      id = token(12);
    const session = {
      id,
      created: now(),
      lastActivity: now(),
      expires: now() + SESSION_MS,
      name: typeof body.name === "string" ? body.name.slice(0, 60) : "Browser",
    };
    const verifier=sha256(secret);
    sessions.set(verifier, session);
    try { save(); } catch(error) { sessions.delete(verifier);throw error; }
    pairing = null;
    return {
      session: {...session,csrf},
      cookie: cookie(secret),
    };
  }
  function authenticate(req) {
    const cookies = (req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .filter((x) => x.startsWith("vortex_session="));
    if (cookies.length !== 1) fail(401, "Pair this browser on the PS5");
    const secret = cookies[0].slice("vortex_session=".length);
    if (!/^[a-f0-9]{64}$/.test(secret)) fail(401,"Session expired or revoked; pair again");
    const session = sessions.get(sha256(secret));
    if (!session || session.expires <= now())
      fail(401, "Session expired or revoked; pair again");
    if (
      req.method !== "GET" &&
      !equal(req.headers["x-vortex-csrf"], sha256(secret+":csrf"))
    )
      fail(403, "CSRF token required");
    return {...session,csrf:sha256(secret+":csrf")};
  }
  function devices() {
    prune();
    return [...sessions.values()].map(({ id, name, created, lastActivity, expires }) => ({
      id,
      name,
      created,
      lastActivity,
      expires,
    }));
  }
  function cookie(secret) { return `vortex_session=${secret}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS/1000}`; }
  function touch(id) {
    const session=[...sessions.values()].find(s=>s.id===id);
    if (!session || session.expires<=now()) fail(401,'Session expired or revoked; pair again');
    const previous={...session},wasDirty=dirty;
    session.lastActivity=now();session.expires=session.lastActivity+SESSION_MS;dirty=true;
    try { if(now()-savedAt>=ACTIVITY_WRITE_MS) save(); }
    catch(error) { Object.assign(session,previous);dirty=wasDirty;throw error; }
  }
  function renewal(req) {
    const match=/(?:^|;\s*)vortex_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'');
    return match?cookie(match[1]):'';
  }
  function flush() { if(dirty) save(); }
  function revoke(id) {
    for (const [secret, s] of sessions)
      if (s.id === id) sessions.delete(secret);
    dirty=true;save();
  }
  function clear() {
    sessions.clear();
    save();
    pairing = null;
    attempts.clear();
    requests.clear();
    globalAttempts = [];
    globalRequests = [];
  }
  return {
    touch, renewal, flush,
    validateRequest,
    newCode,
    pair,
    authenticate,
    devices,
    revoke,
    clear,
    pairing: () => (pairing && pairing.expires > now() ? { ...pairing } : null),
  };
}
