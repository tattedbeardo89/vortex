# Vortex artwork replacement guide

No new binary artwork is generated or committed by this implementation. The main UI and splash use editable Vortex text. custom/vortex/assets/logo.svg is valid, editable SVG source; it is not rasterized by the customization scripts.

| Purpose | Required output filename | Dimensions and format | Default source |
| --- | --- | --- | --- |
| PS5 home-screen icon | icon0.png | 512 × 512 PNG | app/sce_sys/icon0.png |
| Selected-app background | pic0.dds | 3840 × 2160, BC7 DX10 DDS | app/sce_sys/pic0.dds |
| Launch background | pic1.dds | 3840 × 2160, BC7 DX10 DDS | app/sce_sys/pic1.dds |
| Editable documentation/logo placeholder | logo.svg | 512 × 512 viewBox, SVG XML | custom/vortex/assets/logo.svg |

The three existing Overdrive binary home-screen assets are retained temporarily for build compatibility and must be replaced manually for a fully branded console appearance. They are separate from the Vortex title metadata and in-app text identity. Fonts, game covers, game screenshots, sounds and third-party service artwork remain their existing functional assets, not targets for a global rebrand.

Create replacement artwork manually using tools of your choice, with rights to redistribute it. Place supplied files at the three default app/sce_sys paths, or at manually managed paths within this repository and update brand.json assets.icon, selectedBackground and launchBackground. The overlay copies those existing files to their required staged filenames; it never synthesizes images. Do not hand-edit generated `.vortex/vortex` files. No PNG/JPG/ICO/WEBP/Base64/rasterization helper is supplied.

Run npm run prepare:vortex, npm run test:vortex and npm run build:app; the framework checks the icon and packages compatible existing assets. Then npm run build on a mount-capable Linux host. Verify the actual icon/backgrounds on the console before release. Binary screenshots are not part of this change's automated validation; use the preview's text UI snapshots. Background DDS compatibility must be inspected on hardware. Keep credits and legally required source/dependency notices unchanged when replacing artwork.
