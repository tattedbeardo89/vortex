import {register} from 'node:module';
import assert from 'node:assert/strict';
import test from 'node:test';
register(new URL('./native-loader.mjs',import.meta.url),import.meta.url);
const {VERSION,UPSTREAM_VERSION}=await import('../../../.vortex/vortex/version.js');
const {loadUpdate}=await import('../../../.vortex/vortex/state/catalog-update.js');
test('catalog compatibility follows upstream version while Vortex releases remain independent',()=>{
  const cached={format:1,version:UPSTREAM_VERSION,games:[],removed:[],releases:{},pages:{}};
  globalThis.__vortexFS={exists:()=>true,readFile:()=>JSON.stringify(cached)};
  assert.match(VERSION,/^\d+\.\d+\.\d+$/);
  assert.deepEqual(loadUpdate(),cached);
  cached.version="99.999.999";
  assert.equal(loadUpdate(),null);
  delete globalThis.__vortexFS;
});
