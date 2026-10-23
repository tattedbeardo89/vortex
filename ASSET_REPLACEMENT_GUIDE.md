# Vortex Angular V artwork

The original editable master is [custom/vortex/branding/angular-v.svg](custom/vortex/branding/angular-v.svg). Edit its two indigo/violet polygons rather than editing upstream or generated binaries. It contains no font glyph, third-party artwork, enclosing rounded square or tagline.

`npm run prepare:vortex` deterministically generates:

| Surface | Format | Generated path |
| --- | --- | --- |
| PS5 home icon | Transparent 512×512 RGBA PNG | `.vortex/vortex/sce_sys/icon0.png` |
| Selected-app background | 3840×2160 BC7 UNORM DX10 DDS | `.vortex/vortex/sce_sys/pic0.dds` |
| Launch background | 3840×2160 BC7 UNORM DX10 DDS | `.vortex/vortex/sce_sys/pic1.dds` |
| Browser logo and favicon/tab icon | SVG master, transparent | `.vortex/vortex/vortex-web-assets/favicon.svg` |
| Native logo and splash | Vector paths generated from the master | `.vortex/vortex/ui/vortex-emblem.js` |

Pillow is pinned by the existing framework requirements. `custom/vortex/bc7.py` is an original deterministic mode-6 encoder for these flat opaque backgrounds; an independent Pillow BC7 decoder checks its output. Generated binaries are not committed. The build records master/file digests and dimensions in `VORTEX-BRANDING.json` and rejects mismatching packaged artwork. Both the Web and native application use the same source geometry.

Raw upstream app assets remain frozen as baseline evidence; the protected Vortex overlay always replaces them during staging. Full-snapshot synchronization preserves the master/generator and fails closed on incompatible theme/UI/Web hooks. Fonts, game artwork, sounds, provider identities and notices remain untouched.

Run `npm run test:vortex`, `npm run test:web`, `npm run build:web`, and `npm run build:app`; then build `Vortex.exfat` and `update.zip` on a mount-capable Linux host. Verify the actual PS5 home-screen appearance and DDS compatibility on hardware before publication. See [pairing/branding policy](docs/PHASE5_PAIRING_BRANDING.md).
