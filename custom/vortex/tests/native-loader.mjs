const stub = 'data:text/javascript,' + encodeURIComponent('export const FileSystem = {dataDir:"/vortex-test",exists:(...a)=>globalThis.__vortexFS.exists(...a),readFile:(...a)=>globalThis.__vortexFS.readFile(...a)}; export const Http = {};');
export async function resolve(specifier, context, next) {
  if(specifier==='@ps5-react/core') return {url:stub,shortCircuit:true};
  return next(specifier,context);
}
