// The sole consumer of Vortex's private native extension ABI (separate from upstream ABI v19).
export function nativeTransport() {
  const api = globalThis.__vortexWebNative;
  if (
    !api ||
    api.abi !== 1 ||
    ["start", "stop", "random", "poll", "reply"].some(
      (key) => typeof api[key] !== "function",
    )
  )
    throw new Error(
      "Vortex Web native extension ABI 1 is unavailable; remote access stays disabled",
    );
  return api;
}
