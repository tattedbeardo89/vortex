// Original portable SHA-256 for ASCII token material; no runtime or third-party crypto dependency.
const K = [],
  H = [];
for (let n = 2; K.length < 64; n++) {
  let prime = true;
  for (let d = 2; d * d <= n; d++)
    if (n % d === 0) {
      prime = false;
      break;
    }
  if (prime) {
    if (H.length < 8) H.push(((Math.sqrt(n) % 1) * 4294967296) | 0);
    K.push(((Math.cbrt(n) % 1) * 4294967296) | 0);
  }
}
const rotate = (x, n) => (x >>> n) | (x << (32 - n));
export function sha256(text) {
  if (!/^[\x00-\x7f]*$/.test(text))
    throw new Error("ASCII token material required");
  const bytes = [...text].map((c) => c.charCodeAt(0)),
    bits = bytes.length * 8;
  bytes.push(128);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--)
    bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 255);
  const hash = H.slice();
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w = [];
    for (let i = 0; i < 16; i++) {
      const p = offset + i * 4;
      w[i] =
        (bytes[p] << 24) |
        (bytes[p + 1] << 16) |
        (bytes[p + 2] << 8) |
        bytes[p + 3];
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15],
        y = w[i - 2];
      w[i] =
        (w[i - 16] +
          (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) +
          w[i - 7] +
          (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10))) |
        0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const t =
        (h +
          (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
          ((e & f) ^ (~e & g)) +
          K[i] +
          w[i]) |
        0;
      const u =
        ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) +
          ((a & b) ^ (a & c) ^ (b & c))) |
        0;
      h = g;
      g = f;
      f = e;
      e = (d + t) | 0;
      d = c;
      c = b;
      b = a;
      a = (t + u) | 0;
    }
    [a, b, c, d, e, f, g, h].forEach((v, i) => (hash[i] = (hash[i] + v) | 0));
  }
  return hash.map((v) => (v >>> 0).toString(16).padStart(8, "0")).join("");
}
