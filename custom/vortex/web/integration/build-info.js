import { BUILD } from "../../vortex-build.js";
export function readBuild(fs) {
  let mounted = null;
  try {
    mounted = JSON.parse(fs.readFile("/app0/VORTEX-BUILD.json"));
  } catch {}
  const matches = Boolean(
    mounted &&
      [
        "version",
        "commit",
        "webFrontendId",
        "brandingRevision",
        "storagePolicy",
        "nativeShell",
      ].every((key) => mounted[key] === BUILD[key]),
  );
  return {
    ...BUILD,
    mountedBuildCommit: mounted?.commit || "unavailable",
    mountedAssetsMatch: matches,
    ...(matches
      ? {}
      : {
          error:
            "Compiled application and mounted build metadata differ; reinstall the verified image before enabling Web",
        }),
  };
}
