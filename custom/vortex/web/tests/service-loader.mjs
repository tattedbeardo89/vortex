import { readFileSync } from "node:fs";
const build = JSON.parse(
  readFileSync(
    new URL("../../../../.vortex/vortex/VORTEX-BUILD.json", import.meta.url),
    "utf8",
  ),
);
const source = `export const Platform={OS:'desktop'}; export const FileSystem={dataDir:'/vortex-web-test',exists:p=>globalThis.__webFs.has(p),readFile:p=>p==='/app0/VORTEX-BUILD.json'?${JSON.stringify(JSON.stringify(build))}:globalThis.__webFs.get(p),mkdir:()=>{},remove:p=>globalThis.__webFs.delete(p),writeFile:(p,v)=>globalThis.__webFs.set(p,v),rename:(a,b)=>{globalThis.__webFs.set(b,globalThis.__webFs.get(a));globalThis.__webFs.delete(a);}};`;
export async function resolve(specifier, context, next) {
  if (specifier.endsWith("/vortex-build.js"))
    return {
      url:
        "data:text/javascript," +
        encodeURIComponent("export const BUILD=" + JSON.stringify(build)),
      shortCircuit: true,
    };
  if (specifier === "@ps5-react/core")
    return {
      url: "data:text/javascript," + encodeURIComponent(source),
      shortCircuit: true,
    };
  return next(specifier, context);
}
