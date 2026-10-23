// Commit only the synced temporary file. Never recover an older authorization snapshot after revocation.
export function deviceStorage(fs, directory) {
  const file = `${directory}/web-devices.json`;
  return {
    load() {
      if (!fs.exists(file)) {
        if (fs.exists(file + ".tmp"))
          throw new Error(
            "Interrupted device-state creation; reset Web security data on the console",
          );
        return null;
      }
      const text = fs.readFile(file);
      if (text.length > 32768)
        throw new Error("Device state exceeds its limit");
      return JSON.parse(text);
    },
    save(value) {
      fs.mkdir(directory, { recursive: true });
      fs.chmod?.(directory, 0o700);
      fs.writeFile(file + ".tmp", JSON.stringify(value), { sync: true });
      fs.chmod?.(file + ".tmp", 0o600);
      fs.rename(file + ".tmp", file);
    },
  };
}
