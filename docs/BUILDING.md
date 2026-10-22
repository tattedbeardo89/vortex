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

If the build workflow is not registered on the default branch yet, manually dispatch Vortex validation for the implementation branch with package_image=true to produce the same image/update artifacts without any release job.

The manual build workflow uploads artifacts, validation.json, receipt and a Vortex-source.tar snapshot. Optional draft creation is a separate job; there is no automatic publication. See RELEASING.md for additional corresponding-source and rights requirements before publication.

## Prepared cloud machine

Activate `source /workspace/.vortex-env/activate.sh` in each shell. Native prerequisites live under /workspace/.vortex-env; no system-wide install was possible. Its host compiler wrappers add local headers/libraries while the PS5 compiler uses its own SDK. Start with `xvfb-run -a -s '-screen 0 1920x1080x24' npm run dev`. No web preview URL exists. Use text snapshots through ps5-react/tools/ps5_drive.py for automation; do not generate binary screenshots as part of this change. A splash alone does not demonstrate main-interface readiness.

## Reviewed framework test corrections

PR #3's original 134/136 JavaScript result came from a stale five-argument browser-capture assertion and its leaked polling fixture state. The correction retains runtime behavior and all original test assertions, strengthens argument/lifecycle coverage, and repairs the Linux native test harnesses reached afterward. See [the investigation and results](investigations/framework-test-failures.md). These seven exact test/harness changes are hash-reviewed exceptions to the frozen source snapshot; application/catalog/runtime code remains unchanged. Unknown upstream changes fail review rather than silently overwriting the corrections.

## Known inherited test limitations

`npm test` runs Vortex checks, existing app tests, then the framework suite without hiding failures. The original JavaScript assertion/isolation defects and Linux harness issues are corrected as documented above. The local archive stress fixture can still hit the unchanged production memory-pressure guard on a slow host; this remains a hard failure, not a skipped case. See the investigation for current measured results and the selected hosted validation run. Actual prior Vortex build evidence remains in VALIDATION.md.

## Web extension

Vortex 1.1.0 adds a protected web extension; raw upstream app/framework trees remain unchanged. `npm run build:web` verifies integration contracts and emits `.vortex/web-frontend.json` plus static assets in `.vortex/vortex/vortex-web-assets`. `npm run build:app` uses the generated `.vortex/framework` overlay to install the private native listener hook. Its build directory is separate from the unmodified framework's native cache. `VORTEX-WEB.json` in the packaged title records assets, baseline and contracts. Native validation checks the packaged hashes. Existing artwork is reused; no new raster images are generated.

Install browser test dependencies with `npm ci --prefix custom/vortex/web`; run `npm run test:web` and `npm run test:web:browser`. CI installs Chromium, Firefox and WebKit. The root test command runs the corrected framework suite without suppressing failures. See WEB.md for development transport restrictions and WEB_ARCHITECTURE.md for native integration. The old working image lacks this listener: a new native image/update is required for Web, but replacement is not performed automatically.
