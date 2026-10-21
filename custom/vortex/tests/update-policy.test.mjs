import assert from 'node:assert/strict';
import test from 'node:test';
import {BRAND} from '../../../.vortex/vortex/vortex-brand.js';
import {FEED, assertUpdate, newer, releaseUpdate, validateImage} from '../../../.vortex/vortex/state/vortex-update-policy.js';
import {createUpdater} from '../../../.vortex/vortex/state/updater.js';
import {locateInstall} from '../../../.vortex/vortex/state/install-location.js';
const release = (extra = {}) => ({tag_name: 'v1.2.0', draft: false, prerelease: false,
  assets: [{name: 'update.zip', size: 4096, digest: 'sha256:' + 'a'.repeat(64),
    browser_download_url: `https://github.com/${BRAND.repository}/releases/download/v1.2.0/update.zip`}], ...extra});
const selected = () => releaseUpdate(release(), '1.0.0', 'update.zip');
const manifest = (extra = {}) => ({format: 1, name: 'Vortex', repository: BRAND.repository,
  titleId: BRAND.titleId, contentId: BRAND.contentId, version: '1.2.0', image: BRAND.artifact,
  size: 1024 ** 2, ...extra});
const entries = [{name: BRAND.artifact, isFile: true, size: 1024 ** 2},
  {name: 'vortex-update.json', isFile: true, size: 512}];

test('release source is independent and stable semver compares numerically', () => {
  assert.equal(FEED, 'https://api.github.com/repos/tattedbeardo89/vortex/releases/latest');
  assert.equal(selected().version, '1.2.0');
  assert.ok(newer('1.10.0', '1.9.9'));
  for (const version of ['1.2.0-beta', '1.2', '01.2.0', '../../evil', 'Infinity.0.0']) assert.equal(newer(version, '1.0.0'), false);
  assert.equal(newer('1.0.0','1.0.0'),false);
});
test('rejects upstream assets, missing digests, duplicate assets and non-release channels', () => {
  assert.equal(releaseUpdate(release({draft:true}), '1.0.0', 'update.zip'),null);
  assert.equal(releaseUpdate(release({prerelease:true}), '1.0.0', 'update.zip'),null);
  assert.equal(releaseUpdate(release(), '1.0.0', null),null);
  for (const value of ['https://github.com/MyLuxy/overdrive/releases/download/v1.2.0/update.zip',
      'http://github.com/'+BRAND.repository+'/releases/download/v1.2.0/update.zip',
      selected().url+'?redirect=evil', selected().url.replace('v1.2.0','v1.3.0')]) {
    const r=release();r.assets[0].browser_download_url=value;
    assert.equal(releaseUpdate(r, '1.0.0', 'update.zip'),null);
    assert.throws(()=>assertUpdate({...selected(),url:value}));
  }
  for (const mutate of [r=>r.assets[0].digest='',r=>r.assets[0].name='Overdrive.exfat',
      r=>r.assets.push({...r.assets[0]}),r=>r.assets[0].size=-1]) {
    const r=release();mutate(r);assert.equal(releaseUpdate(r,'1.0.0','update.zip'),null);
  }
});
test('extracted package identity and exact contents are validated before replacement', () => {
  assert.equal(validateImage(entries,()=>JSON.stringify(manifest()),selected()).name,BRAND.artifact);
  for(const change of [{name:'Overdrive'},{titleId:'PPSA99058'},{contentId:'wrong'},
      {repository:'MyLuxy/overdrive'},{version:'1.3.0'},{image:'Overdrive.exfat'},{size:512}])
    assert.throws(()=>validateImage(entries,()=>JSON.stringify(manifest(change)),selected()));
  assert.throws(()=>validateImage([...entries,{name:'other',isFile:true}],()=>JSON.stringify(manifest()),selected()));
  assert.throws(()=>validateImage([{...entries[0],isFile:false},entries[1]],()=>JSON.stringify(manifest()),selected()));
});
test('install lookup never selects an Overdrive image, including ShadowMount responses', async () => {
  const fs={exists:()=>true};
  const http={request:async()=>({ok:true,json:async()=>({path:'/data/homebrew/Overdrive.exfat',source_type:'image'})})};
  await assert.rejects(locateInstall({http,fs,roots:()=>['/data'],title:BRAND.titleId}),/outside Vortex/);
  await assert.rejects(locateInstall({http,fs,roots:()=>['/data'],title:'PPSA99058'}),/identity/);
  const fallback={http:{request:async()=>({ok:false})},fs:{exists:path=>path.endsWith('/Vortex.exfat')},roots:()=>['/data'],title:BRAND.titleId};
  const result=await locateInstall(fallback);
  assert.equal(result.image,'/data/homebrew/Vortex.exfat');
  assert.equal(result.workDir,`/data/vortex-update-${BRAND.titleId}`);
  await assert.rejects(locateInstall({...fallback,fs:{exists:path=>path.endsWith('Overdrive.exfat')}}),/found 0/);
});
function fixture({downloadFailure=false, badManifest=false, renameFailure=false}={}) {
  const image='/data/homebrew/Vortex.exfat', workDir='/data/vortex-update', marker='/data/vortex/pending.json';
  const calls=[];
  const fs={exists:path=>path===image,stat:()=>({size:1024**2,modified:5}),diskUsage:()=>({free:10**10}),
    mkdir:()=>{},chmod:()=>{},writeFile:()=>{},readDir:()=>entries,
    readFile:()=>JSON.stringify(manifest(badManifest?{titleId:'PPSA99058'}:{})),
    removeAsync:async()=>{calls.push('cleanup');},rename:(from,to)=>{if(renameFailure)throw new Error('rename refused');calls.push(['rename',from,to]);}};
  const downloads={enqueue:options=>{calls.push(options);return {subscribe:()=>()=>{},done:downloadFailure?Promise.reject(new Error('interrupted')):Promise.resolve()};}};
  const archives={extract:()=>({done:Promise.resolve()})};
  const updater=createUpdater({http:{request:async feed=>{calls.push(feed);return {ok:true,json:async()=>release()};}},
    downloads,archives,fs,version:'1.0.0',feed:FEED,asset:'update.zip',image,workDir,marker});
  return {updater,calls,fs};
}
test('real updater selects Vortex feed, verifies download hash and replaces only Vortex image',async()=>{
  const {updater,calls}=fixture();const update=await updater.check();await updater.install(update);
  assert.ok(calls.includes(FEED));
  const request=calls.find(item=>typeof item==='object'&&!Array.isArray(item));
  assert.equal(request.sha256,'a'.repeat(64));assert.equal(request.expectedBytes,4096);
  assert.deepEqual(calls.find(Array.isArray),['rename','/data/vortex-update/1.2.0/Vortex.exfat','/data/homebrew/Vortex.exfat']);
});
test('interruption, wrong identity and failed rename preserve previous installed image',async()=>{
  for(const options of [{downloadFailure:true},{badManifest:true},{renameFailure:true}]){
    const {updater,calls}=fixture(options);
    await assert.rejects(updater.install(selected()));
    assert.equal(calls.filter(Array.isArray).length,0);
    assert.ok(calls.includes('cleanup'));
  }
});
test('feed overrides and injected install update objects are rejected',async()=>{
  assert.throws(()=>createUpdater({feed:'https://api.github.com/repos/MyLuxy/overdrive/releases/latest'}),/cannot be overridden/);
  const {updater}=fixture();await assert.rejects(updater.install({...selected(),url:'https://example.com/upstream.zip'}),/outside/);
});
