# Repository audit before Vortex changes

Baseline: see `custom/vortex/upstream-inventory.json` for the exact commit, tracked-file count and every text file containing Overdrive or its title ID. Inspected all tracked paths, source/documentation references, dependency locks, workflows and package scripts. Generated caches and vendored downloaded checkouts are not project source.

## Structure and identity

`app/` contains the recovered React application, 18 locale files, catalog data, assets and state. `ps5-react/` is the vendored native framework and pinned build tooling. `packaging/` installs prerequisites, builds and mounts exFAT images. `tools/` imports/enriches catalogs. `covers/` and `.github/readme/` contain existing binary artwork. `.github/ISSUE_TEMPLATE/` contains support links. The original README contains installation, development, recovery history and credits.

Overdrive uses PPSA99058, content UP9000-PPSA99058_00-OVERDRIVE0000000, `dist/PPSA99058`, `Overdrive.exfat`, and an image-only `update.zip`. app/version.js is 1.0.9 while app.json is 01.003.000: these are already inconsistent. Downloads has a hardcoded /data/ps5-react/PPSA99058/queue. Generic persistence folders are named overdrive but normally nested in title-specific dataDir. Provider strings such as “overdrive cdn” are functional catalog keys and must stay intact.

## Updates and URLs

app/state/update.js chooses the latest GitHub release, allows local feed override files, discovers its install and creates updater.js. updater.js requires GitHub's SHA-256 release-asset digest, passes it to native Downloads, extracts an archive and renames its image over the installed one. It has a pending marker and cleanup; folder-install code also exists. install-location.js queries local ShadowMount by title, then scans homebrew folders/images. Its fallback accepts Overdrive image names. These must be isolated for Vortex; feed overrides and permissive image names are inappropriate for an independent release channel.

Keep functional upstream sources: app/state/catalog-update.js reads MyLuxy/overdrive's catalog branch; app/data/catalog.js and cover mappings use upstream raw content; homebrew.js uses the existing homebrew API; download providers and imported release/page datasets stay unchanged. Third-party service URLs are not branding. Dependency references to MyLuxy/overdrive-deps preserve otherwise unavailable pinned build sources. Local ShadowMount is http://127.0.0.1:10101; no new external provider is needed.

## Build and automation

Root npm wraps packaging/build.sh and ps5-react/tools/cli.py. LLVM 18, Python 3.12+, Pillow, locked npm dependencies, CMake, Ninja, NASM and native libraries are required. The PS5 builder creates a signed plaintext SELF, ZIP and provenance receipt and validates them. exFAT packaging needs root plus kernel/FUSE mounts. Desktop preview supports this fork's Linux SDL/OpenGL implementation.

build.yml is manual Ubuntu 24.04 build/package/upload/draft-release automation. catalog.yml is a daily catalog ingestion job with optional IGDB secrets and writes a catalog branch; it is separate from release or upstream synchronization. Vortex will retain it as manual-only unless operators explicitly configure catalog ingestion. Upstream synchronization must only open integration PRs, never publish.

## Licensing and redistribution

MyLuxy recovered Overdrive from its released binary; original app source headers retain that provenance, but there is no separate top-level application license grant. Do not assert ownership of original code or a new blanket license. Framework code is GPL-3.0-or-later with GPLv3 §7(b) attribution (ps5-react/LICENSE-ATTRIBUTION); preserve its LICENSE, NOTICE, source availability, notices and dependency provenance. See ps5-react/docs/DEPENDENCIES.md for the complete audit: Embedded React Apache-2.0; React/QuickJS MIT; Inter/Noto OFL; sounds CC BY 4.0; curl/libarchive/zlib and other native components have their own licenses. UnRAR is NOT GPL-compatible and must remain a separate extraction program with its license and restrictions; never link it into the engine. No proprietary Sony modules are redistributed by this build.

A draft artifact is not evidence of redistribution clearance for recovered app source, catalog data or third-party game artwork. Release maintainers must review rights and deliver corresponding source and required notices before publishing binaries. Required contributors include MyLuxy, half144 and PS5 React contributors, the original upstream contributors, and each dependency's authors. Do not delete existing license or source notices.

## Planned merge boundary

Keep upstream app and framework sources untouched. custom/vortex will copy app into an ignored staging directory, verify SHA-256 contracts for every customized source, then apply reviewed patches/configuration. Modified contract files or newly introduced identity references stop generation for review. Build entrypoints and workflows are the small intentional integration surface. Keep Vortex's version, title identity, release feed and theme outside upstream app/version.js. Use ordinary upstream merges on an integration branch, with explicit conflicts and no main resets or automatic releases.
