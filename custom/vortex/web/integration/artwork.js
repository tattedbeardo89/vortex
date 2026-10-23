import { BUILD } from "../../vortex-build.js";
const ROOT = "/user/appmeta/PPSA99189";
const BACKUP = "/data/vortex/PPSA99189/artwork-backup";
function checkIdentity(fs, path) {
  const info = JSON.parse(fs.readFile(path));
  if (
    info.titleId !== "PPSA99189" ||
    info.contentId !== "UP9000-PPSA99189_00-VORTEXPS50000000"
  )
    throw new Error("Artwork title identity mismatch; no files changed");
}
export function inspectArtwork(
  fs,
  hash = globalThis.__vortexWebNative?.artworkHash,
) {
  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFile("/app0/VORTEX-BRANDING.json"));
  } catch {}
  const files = {};
  for (const name of ["icon0.png", "pic0.dds", "pic1.dds"]) {
    const expected = BUILD.artwork?.["sce_sys/" + name]?.sha256 || null;
    const mounted = typeof hash === "function" ? hash("mounted", name) : null;
    const registered =
      typeof hash === "function" ? hash("registered", name) : null;
    const staged = typeof hash === "function" ? hash("staged", name) : null;
    const stagedIcon =
      name === "icon0.png" && typeof hash === "function"
        ? hash("staged-icon", name)
        : null;
    files[name] = {
      staged,
      stagedIcon,
      expected,
      mounted,
      registered,
      mountedMatches: Boolean(expected && mounted === expected),
      registeredMatches: Boolean(expected && registered === expected),
    };
  }
  return {
    compiledRevision: BUILD.brandingRevision,
    mountedRevision: manifest?.masterSha256 || null,
    registeredPath: ROOT,
    files,
    hardwareCacheVerified: false,
  };
}
// ShadowMount maintains both appmeta and app staging (including a root icon copy).
const NAMES = ["icon0.png", "pic0.dds", "pic1.dds"];
const STAGED = "/user/app/PPSA99189";
function targets(fs) {
  checkIdentity(fs, ROOT + "/param.json");
  const result = NAMES.map((name) => ({
    source: "/app0/sce_sys/" + name,
    target: ROOT + "/" + name,
    backup: BACKUP + "/" + name,
  }));
  const metadata = [
    { source: ROOT + "/param.json", backup: BACKUP + "/param.json" },
  ];
  if (fs.exists(STAGED + "/sce_sys/param.json")) {
    checkIdentity(fs, STAGED + "/sce_sys/param.json");
    metadata.push({
      source: STAGED + "/sce_sys/param.json",
      backup: BACKUP + "/staged/param.json",
    });
    for (const name of NAMES)
      if (fs.exists(STAGED + "/sce_sys/" + name))
        result.push({
          source: "/app0/sce_sys/" + name,
          target: STAGED + "/sce_sys/" + name,
          backup: BACKUP + "/staged/" + name,
        });
    if (fs.exists(STAGED + "/icon0.png"))
      result.push({
        source: "/app0/sce_sys/icon0.png",
        target: STAGED + "/icon0.png",
        backup: BACKUP + "/staged-root-icon0.png",
      });
  } else if (fs.exists(STAGED + "/icon0.png"))
    throw new Error(
      "Staged icon exists without verifiable Vortex identity; no files changed",
    );
  return { result, metadata };
}
export function refreshArtwork(
  fs,
  platform,
  hash = globalThis.__vortexWebNative?.artworkHash,
) {
  if (platform !== "ps5")
    throw new Error("Registered artwork refresh is available only on PS5");
  checkIdentity(fs, "/app0/sce_sys/param.json");
  const { result, metadata } = targets(fs);
  for (const file of result)
    if (!fs.exists(file.source) || !fs.exists(file.target))
      throw new Error(
        "Artwork source or registered file missing; no files changed",
      );
  if (
    typeof hash !== "function" ||
    !Object.values(inspectArtwork(fs, hash).files).every(
      (file) => file.mountedMatches,
    )
  )
    throw new Error(
      "Mounted artwork not verified against compiled checksums; no files changed",
    );
  fs.mkdir(BACKUP, { recursive: true });
  fs.mkdir(BACKUP + "/staged", { recursive: true });
  // Complete all first-original backups BEFORE changing ANY registered/staged artwork.
  for (const file of [
    ...metadata,
    ...result.map((file) => ({ source: file.target, backup: file.backup })),
  ])
    if (!fs.exists(file.backup)) fs.copyFile(file.source, file.backup);
  for (const file of result) {
    fs.copyFile(file.source, file.target);
    fs.chmod(file.target, 0o644);
  }
  return "Verified Vortex artwork refreshed in appmeta and available title staging. Originals and registration metadata backed up. Close Vortex and reboot the PS5 shell; user data unchanged.";
}
export function restoreArtwork(fs, platform) {
  if (platform !== "ps5")
    throw new Error("Artwork rollback is available only on PS5");
  const { result, metadata } = targets(fs);
  for (const file of metadata) checkIdentity(fs, file.backup);
  for (const file of result)
    if (!fs.exists(file.backup))
      throw new Error("Incomplete artwork backup; no files changed");
  for (const file of result) {
    fs.copyFile(file.backup, file.target);
    fs.chmod(file.target, 0o644);
  }
  return "Original Vortex artwork restored. Close Vortex and reboot the PS5 shell. Backups retained; user data unchanged.";
}
