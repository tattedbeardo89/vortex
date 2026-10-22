import {register} from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync,readFileSync} from 'node:fs';
register(new URL('./native-loader.mjs',import.meta.url),import.meta.url);
const {VERSION,UPSTREAM_VERSION}=await import('../../../.vortex/vortex/version.js');
const baseline=JSON.parse(readFileSync(new URL('../upstream-baseline.json',import.meta.url)));
test('catalog-update capability and compatibility exactly follow selected upstream',async()=>{
  assert.equal(UPSTREAM_VERSION,baseline.sourceVersion);
  assert.match(VERSION,/^\d+\.\d+\.\d+$/);
  const consumer=new URL('../../../.vortex/vortex/state/catalog-update.js',import.meta.url);
  assert.equal(existsSync(consumer),baseline.catalog.updateConsumer);
  if(!baseline.catalog.updateConsumer)return; // v1.0.8 has no consumer: never invent one.
  const {loadUpdate}=await import(consumer);
  const cached={format:1,version:UPSTREAM_VERSION,games:[],removed:[],releases:{},pages:{}};
  globalThis.__vortexFS={exists:()=>true,readFile:()=>JSON.stringify(cached)};
  try {
    assert.deepEqual(loadUpdate(),cached);
    cached.version='99.999.999';assert.equal(loadUpdate(),null);
  } finally {delete globalThis.__vortexFS;}
});
