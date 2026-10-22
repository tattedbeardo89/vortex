# Vortex

**Vortex - PS5 Homebrew and Game Store**

A Seerr-themed fork with protected branding and an optional LAN browser interface, based on [Overdrive by MyLuxy](https://github.com/MyLuxy/overdrive), built with [PS5 React](https://github.com/half144/ps5-react). Vortex retains catalog browsing, homebrew, search, favorites, downloads, storage tools, controller navigation and all 18 languages.

Repository and releases: **https://github.com/tattedbeardo89/vortex**. The originally proposed vortex-ps5 repository was unavailable; the owner selected this existing repository instead.

The selected upstream baseline is **published Overdrive v1.0.8**, commit `9f90d882771eb87f75579b10f951cc2dbe4daf2a`. Vortex 1.1.0 retains its real catalog: **1,148 total / 1,009 PS5 / 139 PS4**, and 104 visible homebrew apps in the recorded real API snapshot. Counts are measured, not enforced. See the [baseline/parity report](docs/BRANDING_ONLY.md).

## Install alongside Overdrive

Download **Vortex.exfat** from a Vortex release. Place it in `homebrew/Vortex.exfat` on an exFAT USB drive, or `/data/homebrew/Vortex.exfat` on the console. ShadowMount+ and the supported console prerequisites remain necessary; see the [original installation documentation](docs/UPSTREAM_README.md#install-in-four-steps).

Vortex uses **PPSA99189**, content **UP9000-PPSA99189_00-VORTEXPS50000000**, and a separate data/queue path. Overdrive remains PPSA99058. Do not rename or overwrite Overdrive.exfat. The new ID is structurally valid and unused in this source tree, not a Sony-assigned or globally reserved ID. The prior Vortex build was user-confirmed to boot; this new 1.0.8-baseline artifact requires separate hardware validation. Existing home-screen raster artwork is temporarily retained; the running UI uses a Vortex text identity. See [artwork replacements](ASSET_REPLACEMENT_GUIDE.md).

## Vortex Web

Open **Web** on the console to enable the disabled-by-default browser interface and pair a browser on your trusted LAN. Vortex must remain open. See [Web setup](docs/WEB.md), [architecture](docs/WEB_ARCHITECTURE.md) and [security](docs/WEB_SECURITY.md). Desktop/browser tests and PS5 cross-builds do not establish physical console operation.

## Develop and build

```sh
npm run setup          # supported apt/Homebrew desktop prerequisites; may request sudo
npm run prepare:vortex # generate .vortex/vortex without editing upstream app/
npm run dev            # native desktop preview; watch/restart on changes
npm run test:vortex    # identity, overlay, synchronization and updater regression tests
npm run test:app       # existing application state tests
npm run test:framework # original native/framework test runner
npm run build:app      # verified PS5 folder, ZIP and receipt in ps5-react/dist/
npm run build          # additionally creates Vortex.exfat and update.zip; needs root/mounts
```

Use LLVM 18 (including lld), Python 3.12+, pinned Pillow and locked npm dependencies. The prepared cloud machine also needs `source /workspace/.vortex-env/activate.sh` and a fixed virtual display: `xvfb-run -a -s '-screen 0 1920x1080x24' npm run dev`. See [building](docs/BUILDING.md) for fresh-host and cloud instructions and known upstream test limitations. No console upload or deployment happens during builds.

## Maintain the fork

Vortex customization lives under [`custom/vortex/`](custom/vortex/), not throughout the upstream app. The overlay verifies reviewed source hashes, applies two focused updater patches, preserves upstream component structure while replacing vector/name branding and generates independent metadata/version/theme files. It refuses unreviewed changes to customized upstream files.

Daily synchronization opens or updates one draft integration PR; it never resets main or publishes a release. Manual Vortex builds default to artifact-only output; optional release creation is draft-only. Upstream and Vortex release versions are separate. Source and catalog revisions advance together in reviewed integration PRs. This v1.0.8 baseline has no runtime commercial catalog-update consumer, exactly as upstream.

- [Branding and theme](docs/BRANDING.md)
- [Upstream synchronization and conflict review](docs/UPSTREAM_SYNC.md)
- [Web setup and pairing](docs/WEB.md)
- [Web validation and build artifacts](docs/WEB_VALIDATION.md)
- [Building](docs/BUILDING.md)
- [Releasing](docs/RELEASING.md)
- [Updates and recovery](docs/UPDATING.md)
- [Repository and license audit](docs/REPOSITORY_AUDIT.md)

## Credits and licensing

MyLuxy recovered and maintains Overdrive; original source recovery headers remain unchanged. **PS5 React — created by half144 and PS5 React contributors.** Preserve its GPL-3.0-or-later license and attribution term, original contributor notices, and every dependency's own license. Vortex does not claim ownership of upstream code or replace its license grants. The recovered app has no separate top-level license grant; review redistribution rights before publishing binaries. UnRAR remains a separate program with its own non-GPL-compatible extraction license. See [dependency licensing](ps5-react/docs/DEPENDENCIES.md), [NOTICE](custom/vortex/NOTICE.txt), and the retained [original README](docs/UPSTREAM_README.md). Vortex is not affiliated with Sony.
