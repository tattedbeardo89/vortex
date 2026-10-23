// PS5 authorization must not depend on a writable ShadowMount/download0 image.
export function storageLocation(fs, platform) {
  return platform === "ps5"
    ? "/data/vortex/PPSA99189/web"
    : `${fs.dataDir}/vortex`;
}
export function prepareStorage(fs, directory, legacy) {
  fs.mkdir(directory, { recursive: true });
  fs.chmod?.(directory, 0o700);
  const marker = `${directory}/storage-policy.json`;
  if (directory !== legacy && !fs.exists(marker)) {
    // Commit a migration marker only after copying the current committed snapshots.
    // Interrupted migration retries never overwrite an already committed destination.
    for (const name of ["web.json", "web-devices.json"]) {
      const target = `${directory}/${name}`,
        source = `${legacy}/${name}`;
      if (!fs.exists(target) && fs.exists(source)) {
        const text = fs.readFile(source);
        if (text.length > 32768)
          throw new Error("Legacy Web state exceeds its limit");
        JSON.parse(text); // Authentication validates the full device schema before use.
        fs.writeFile(target + ".tmp", text, { sync: true });
        fs.chmod?.(target + ".tmp", 0o600);
        fs.rename(target + ".tmp", target);
      }
    }
    fs.writeFile(
      marker + ".tmp",
      JSON.stringify({ format: 1, migrated: true }),
      { sync: true },
    );
    fs.rename(marker + ".tmp", marker);
  }
  return probeStorage(fs, directory);
}
let serial = 0;
export function probeStorage(fs, directory) {
  const path = `${directory}/.storage-probe-${Date.now()}-${++serial}`;
  let result;
  try {
    fs.mkdir(directory, { recursive: true });
    fs.chmod?.(directory, 0o700);
    if (fs.exists(path) || fs.exists(path + ".tmp"))
      throw new Error("Probe name collision");
    fs.writeFile(path + ".tmp", "Vortex storage probe", { sync: true });
    fs.rename(path + ".tmp", path);
    if (fs.readFile(path) !== "Vortex storage probe")
      throw new Error("Storage read-back failed");
    result = {
      accessible: true,
      writable: true,
      atomicRename: true,
      directory,
      hardwareDurabilityVerified: false,
    };
  } catch {
    result = {
      accessible: false,
      writable: false,
      atomicRename: false,
      directory,
      hardwareDurabilityVerified: false,
      error:
        "Durable storage probe failed; verify filesystem access on the console",
    };
  } finally {
    for (const file of [path + ".tmp", path])
      try {
        if (fs.exists(file)) fs.remove(file);
      } catch {
        result = {
          ...result,
          writable: false,
          error: "Storage probe cleanup failed",
        };
      }
  }
  return result;
}
