const source = `export const FileSystem={dataDir:'/vortex-web-test',exists:p=>globalThis.__webFs.has(p),readFile:p=>globalThis.__webFs.get(p),mkdir:()=>{},writeFile:(p,v)=>globalThis.__webFs.set(p,v),rename:(a,b)=>{globalThis.__webFs.set(b,globalThis.__webFs.get(a));globalThis.__webFs.delete(a);}};`;
export async function resolve(specifier, context, next) {
  if (specifier === "@ps5-react/core")
    return {
      url: "data:text/javascript," + encodeURIComponent(source),
      shortCircuit: true,
    };
  return next(specifier, context);
}
