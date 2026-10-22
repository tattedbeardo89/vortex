import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const resolve=path=>path.startsWith('/app0/')?join(process.env.CATALOG_APP_ROOT,path.slice(6)):
  path==='/diagnostic/overdrive/catalog-update.json'||path==='/diagnostic/vortex/catalog-update.json'?process.env.CATALOG_UPDATE_FILE:
  path==='/diagnostic/overdrive/homebrew.json'||path==='/diagnostic/vortex/homebrew.json'?process.env.CATALOG_HOMEBREW_FILE:null;
export const FileSystem={rename:()=>{throw new Error('Diagnostic filesystem is read-only');},dataDir:'/diagnostic',exists:path=>Boolean(resolve(path)&&existsSync(resolve(path))),
  readFile:path=>{const file=resolve(path);if(!file)throw new Error('Diagnostic file unavailable');return readFileSync(file,'utf8');}};
export const Image={warm:()=>{}};
export const Http={request:()=>{throw new Error('Network access is deliberately not part of offline catalog evaluation');}};
