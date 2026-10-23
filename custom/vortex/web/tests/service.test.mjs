import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { register } from "node:module";
register(new URL("./service-loader.mjs", import.meta.url), import.meta.url);
globalThis.__webFs = new Map();
const service = await import("../integration/console-service.js");
test("production service stays disabled until enabled locally, rejects unauthenticated API and stops cleanly", async () => {
  let starts = 0,
    stops = 0;
  const pending = [],
    replies = [];
  globalThis.__vortexWebNative = {
    abi: 1,
    start: (_binding, port) => {
      starts++;
      return port;
    },
    stop: () => stops++,
    random: (n) => randomBytes(n).toString("hex"),
    poll: () => pending.splice(0),
    reply: (...args) => replies.push(args),
  };
  const stop = service.startService({ catalog: () => ({ total: 1148 }) });
  assert.equal(starts, 0);
  assert.equal(service.snapshot().enabled, false);
  assert.equal(service.snapshot().running, false);
  try {
    service.apply({
      enabled: true,
      port: 34189,
      binding: "0.0.0.0",
      readOnly: false,
    });
    assert.equal(starts, 1);
    assert.equal(service.snapshot().running, true);
    pending.push({
      id: 1,
      method: "GET",
      target: "/api/v1/catalog",
      peer: "192.168.1.2",
      local: "192.168.1.9",
      headers: { host: "192.168.1.9:34189" },
      body: "",
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(replies[0][1], 401);
    service.apply({ ...service.snapshot(), enabled: false });
    assert.equal(service.snapshot().running, false);
    assert.equal(service.snapshot().devices.length, 0);
    assert.equal(service.snapshot().pairing, null);
    assert.ok(stops > 0);
  } finally {
    stop();
    delete globalThis.__vortexWebNative;
    globalThis.__webFs.clear();
  }
});
test("native ABI or CSPRNG failure cannot fall back to an unsecured listener", () => {
  service.startService({});
  globalThis.__vortexWebNative = {
    abi: 1,
    start: () => 34189,
    stop: () => {},
    random: () => "",
    poll: () => [],
    reply: () => {},
  };
  try {
    service.apply({
      enabled: true,
      port: 34189,
      binding: "0.0.0.0",
      readOnly: false,
    });
    assert.equal(service.snapshot().enabled, false);
    assert.equal(service.snapshot().running, false);
    assert.match(service.snapshot().error, /random/i);
  } finally {
    service.stopService();
    delete globalThis.__vortexWebNative;
    globalThis.__webFs.clear();
  }
});
test("responses pending across listener restart cannot reach a new client", async () => {
  let complete, entered;
  const deferred = new Promise((resolve) => {
    complete = resolve;
  });
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const requests = [],
    replies = [];
  globalThis.__vortexWebNative = {
    abi: 1,
    start: () => 34189,
    stop: () => {},
    random: (n) => randomBytes(n).toString("hex"),
    poll: () => requests.splice(0),
    reply: (...args) => replies.push(args),
  };
  const stop = service.startService({
    status: async () => {
      entered();
      await deferred;
      return { private: "previous session" };
    },
  });
  const req = (id, method, target, headers = {}, body = "") => ({
    id,
    method,
    target,
    peer: "127.0.0.1",
    local: "127.0.0.1",
    headers: { host: "127.0.0.1:34189", ...headers },
    body,
  });
  try {
    service.apply({
      enabled: true,
      port: 34189,
      binding: "127.0.0.1",
      readOnly: false,
    });
    requests.push(
      req(
        1,
        "POST",
        "/api/v1/auth/pair",
        {
          origin: "http://127.0.0.1:34189",
          "content-type": "application/json",
        },
        JSON.stringify({ code: service.snapshot().pairing.code }),
      ),
    );
    for (let i = 0; i < 50 && !replies.length; i++)
      await new Promise((r) => setTimeout(r, 10));
    assert.equal(replies[0][1], 200);
    const cookie = replies[0][4].split(";")[0];
    requests.push(req(2, "GET", "/api/v1/status", { cookie }));
    await started;
    service.apply({ ...service.snapshot(), enabled: true });
    replies.length = 0;
    complete();
    await new Promise((r) => setTimeout(r, 80));
    assert.equal(replies.length, 0);
  } finally {
    complete();
    stop();
    delete globalThis.__vortexWebNative;
    globalThis.__webFs.clear();
  }
});

test('production service and reconstructed module retain paired browser outside replaceable image', async()=>{
  const pending=[],replies=[];
  globalThis.__webFs.clear();
  globalThis.__vortexWebNative={abi:1,start:(_b,p)=>p,stop:()=>{},random:n=>randomBytes(n).toString('hex'),poll:()=>pending.splice(0),reply:(...r)=>replies.push(r)};
  const req=(id,method,target,headers={},body='')=>({id,method,target,peer:'127.0.0.1',local:'127.0.0.1',headers:{host:'127.0.0.1:34189',origin:'http://127.0.0.1:34189','content-type':'application/json',...headers},body});
  const waitReply=async()=>{for(let i=0;i<100&&!replies.length;i++)await new Promise(r=>setTimeout(r,10));assert.ok(replies.length);return replies.shift();};
  let restarted;
  try {
    service.startService({});service.apply({enabled:true,port:34189,binding:'127.0.0.1',readOnly:false});
    pending.push(req(100,'POST','/api/v1/auth/pair',{},JSON.stringify({code:service.snapshot().pairing.code})));
    const pair=await waitReply();assert.equal(pair[1],200);const cookie=pair[4].split(';')[0];
    assert.ok(globalThis.__webFs.has('/vortex-web-test/vortex/web-devices.json'));
    service.stopService();
    restarted=await import('../integration/console-service.js?process-reconstruction');
    restarted.startService({});
    pending.push(req(101,'GET','/api/v1/auth/session',{cookie}));assert.equal((await waitReply())[1],200);
    restarted.revoke(restarted.snapshot().devices[0].id);
    restarted.apply({...restarted.snapshot(),enabled:true});
    pending.push(req(102,'GET','/api/v1/auth/session',{cookie}));assert.equal((await waitReply())[1],401);
  } finally {service.stopService();restarted?.stopService();globalThis.__webFs.clear();delete globalThis.__vortexWebNative;}
});
