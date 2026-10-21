import {BRAND} from '../vortex-brand.js';
export const FEED = `https://api.github.com/repos/${BRAND.repository}/releases/latest`;
const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function validVersion(version) {
  return typeof version === 'string' && stable.test(version) &&
    version.split('.').every(n => Number.isSafeInteger(Number(n)));
}
export function newer(a, b) {
  if (!validVersion(a) || !validVersion(b)) return false;
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}
export function assertUpdate(update) {
  if (!validVersion(update?.version) ||
      update.url !== `https://github.com/${BRAND.repository}/releases/download/v${update.version}/${BRAND.updateAsset}` ||
      !/^[0-9a-f]{64}$/i.test(update.sha256 ?? '') ||
      !Number.isSafeInteger(update.size) || update.size <= 0) {
    throw new Error('Refusing an update outside the Vortex release channel');
  }
}
export function releaseUpdate(release, version, asset) {
  if (!asset || asset !== BRAND.updateAsset || release.draft || release.prerelease ||
      typeof release.tag_name !== 'string' || !release.tag_name.startsWith('v')) return null;
  const next = release.tag_name.slice(1);
  if (!newer(next, version)) return null;
  const files = (release.assets ?? []).filter(item => item.name === asset);
  if (files.length !== 1) return null;
  const file = files[0];
  const digest = /^sha256:([0-9a-f]{64})$/i.exec(file.digest ?? '')?.[1];
  const update = {version: next, notes: release.body ?? '', url: file.browser_download_url,
    size: file.size, sha256: digest};
  try { assertUpdate(update); } catch { return null; }
  return update;
}
export function validateImage(entries, readFile, update) {
  assertUpdate(update);
  if (entries.length !== 2 || entries.some(e => !e.isFile) ||
      !entries.some(e => e.name === 'vortex-update.json') || !entries.some(e => e.name === BRAND.artifact))
    throw new Error('Expected a Vortex image and identity manifest only');
  const manifestEntry = entries.find(e => e.name === 'vortex-update.json');
  if (manifestEntry.size > 16384) throw new Error('Oversized Vortex manifest');
  const manifest = JSON.parse(readFile('vortex-update.json'));
  const image = entries.find(e => e.name === BRAND.artifact);
  if (manifest.format !== 1 || manifest.name !== BRAND.name || manifest.repository !== BRAND.repository ||
      manifest.titleId !== BRAND.titleId || manifest.contentId !== BRAND.contentId ||
      manifest.version !== update.version || manifest.image !== BRAND.artifact ||
      !Number.isSafeInteger(image.size) || image.size < 1024 ** 2 || image.size % 512 ||
      image.size !== manifest.size)
    throw new Error('Vortex update identity, version or image size mismatch');
  return image;
}
