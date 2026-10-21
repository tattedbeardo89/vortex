# Building Vortex

Use Ubuntu 24.04 for CI and exFAT packaging. macOS preview support is retained upstream; a Linux native preview needs SDL2/OpenGL and a display. Run npm run setup after inspecting packaging/setup.sh. Required PS5 tools: LLVM/Clang/lld 18, cmake, ninja, nasm, pkg-config, zlib development files, zstd, unzip, Python 3.12+, Pillow pinned by ps5-react/requirements.txt and npm ci in ps5-react. Keep the lockfiles and checksum/TLS verification intact. exFAT packaging also needs exfatprogs, exfat-fuse and sudo/root mount access.

```
npm run prepare:vortex
npm run test:vortex
npm run test:app
npm run build:app
```

The existing framework compiles `.vortex/vortex`, not app/. Outputs: ps5-react/dist/PPSA99189/, PPSA99189.zip and PPSA99189.receipt.json. Build validation checks Vortex name, content/title IDs, version consistency, packaged attribution, existing ELF/SELF checks, hashes and folder ZIP. Upstream artifacts for PPSA99058 are never selected as Vortex output.

`npm run build` then calls the original make-exfat.sh with Vortex's title folder, Vortex.exfat and label VORTEX. package_update.py creates update.zip containing exactly Vortex.exfat plus vortex-update.json. The identity manifest includes Vortex repository, title/content IDs, semantic version and image size. package_update.py --verify checks manifest identity, exact ZIP contents, exFAT header, size and CRC. It is not a Sony signature or a runtime console test. Updater ZIP digest validation remains mandatory.

The manual build workflow uploads artifacts, validation.json, receipt and a Vortex-source.tar snapshot. Optional draft creation is a separate job; there is no automatic publication. See RELEASING.md for additional corresponding-source and rights requirements before publication.

## Prepared cloud machine

Activate `source /workspace/.vortex-env/activate.sh` in each shell. Native prerequisites live under /workspace/.vortex-env; no system-wide install was possible. Its host compiler wrappers add local headers/libraries while the PS5 compiler uses its own SDK. Start with `xvfb-run -a -s '-screen 0 1920x1080x24' npm run dev`. No web preview URL exists. Use text snapshots through ps5-react/tools/ps5_drive.py for automation; do not generate binary screenshots as part of this change. A splash alone does not demonstrate main-interface readiness.

## Known inherited test limitations

`npm test` runs Vortex checks, existing app tests, then the original framework suite; it does not hide failures. Baseline framework JavaScript has 136/138 passing (browser-capture host-argument mismatch and cascading LAN test; LAN passes alone). Native network/video tests omit Linux OpenSSL link dependencies; the image client includes macOS-only malloc/malloc.h; archive tests hardcode /usr/bin/bsdtar rather than using the available rootless PATH. Native resource/removal/text/passthrough/browser-matcher checks and starter rendering/input/parity passed during environment setup. App tests include a deliberately skipped test. Actual current Vortex validation results are recorded in VALIDATION.md.
