import {BRAND} from '../vortex-brand.js';
const SHADOWMOUNT = 'http://127.0.0.1:10101/api/v1/games/info';
const STORAGE_ROOT = /^(\/data|\/mnt\/(?:usb|ext)\d+)\//;

function imagePath(path) {
  return typeof path === 'string' && STORAGE_ROOT.test(path) &&
    path.split('/').every(part => part !== '..' && part !== '.') &&
    path.endsWith('/' + BRAND.artifact);
}

export async function locateInstall({http, fs, roots, title}) {
  if (title !== BRAND.titleId) throw new Error('Vortex title identity mismatch');
  let info;
  try {
    const response = await http.request(SHADOWMOUNT, {method: 'POST',
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({title_id: title}), maxBytes: 65536});
    if (response.ok) info = await response.json();
  } catch { /* ShadowMount versions without this endpoint use the strict fallback. */ }
  let install;
  if (info?.path) {
    if (info.source_type === 'image' && imagePath(info.path)) install = {image: info.path};
    else if (info.source_type === 'folder' && STORAGE_ROOT.test(info.path) &&
      info.path.endsWith('/' + title)) install = {installDir: info.path};
    else throw new Error('ShadowMount returned an installation outside Vortex identity; refusing replacement');
  } else {
    const found = roots().flatMap(root => {
      const image = `${root}/homebrew/${BRAND.artifact}`;
      const installDir = `${root}/homebrew/${title}`;
      return [...(imagePath(image) && fs.exists(image) ? [{image}] : []),
        ...(fs.exists(`${installDir}/eboot.bin`) ? [{installDir}] : [])];
    });
    if (found.length !== 1) throw new Error(`Expected one Vortex installation; found ${found.length}`);
    install = found[0];
  }
  if (!fs.exists(install.image ?? `${install.installDir}/eboot.bin`)) throw new Error('Vortex installation is missing');
  const root = STORAGE_ROOT.exec(install.image ?? install.installDir)?.[1];
  return {...install, workDir: `${root}/vortex-update-${title}`};
}
