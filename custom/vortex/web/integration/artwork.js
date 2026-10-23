// Explicit console-only repair of ShadowMount's registered artwork. Never an HTTP endpoint.
export function refreshArtwork(fs, platform) {
  if (platform !== "ps5")
    throw new Error("Registered artwork refresh is available only on PS5");
  const root = "/user/appmeta/PPSA99189",
    backup = "/data/vortex/PPSA99189/artwork-backup";
  const check = (path) => {
    const info = JSON.parse(fs.readFile(path));
    if (
      info.titleId !== "PPSA99189" ||
      info.contentId !== "UP9000-PPSA99189_00-VORTEXPS50000000"
    )
      throw new Error("Artwork title identity mismatch; no files changed");
  };
  check("/app0/sce_sys/param.json");
  check(root + "/param.json");
  const files = ["icon0.png", "pic0.dds", "pic1.dds"];
  for (const name of files)
    if (!fs.exists("/app0/sce_sys/" + name) || !fs.exists(root + "/" + name))
      throw new Error(
        "Artwork source or registered file missing; no files changed",
      );
  fs.mkdir(backup, { recursive: true });
  // Back up every original before any registered asset is replaced. Keep first backups.
  for (const name of files)
    if (!fs.exists(backup + "/" + name))
      fs.copyFile(root + "/" + name, backup + "/" + name);
  for (const name of files) {
    fs.copyFile("/app0/sce_sys/" + name, root + "/" + name); // Native copy uses synced temp + rename.
    fs.chmod(root + "/" + name, 0o644);
  }
  return "Registered Angular V artwork refreshed. Originals are backed up. Close Vortex and reboot/restart the PS5 shell to refresh its in-memory artwork. User data was not removed.";
}
