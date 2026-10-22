# Vortex branding and Seerr-inspired theme

Vortex is a branding-only fork of the exact source selected in `custom/vortex/upstream-baseline.json`. The initial baseline is published Overdrive v1.0.8 (`9f90d882771eb87f75579b10f951cc2dbe4daf2a`), including its framework, catalog, providers, filters and application features. Vortex's independent version is 1.0.1 (PS5 content version 01.000.001); its title ID remains PPSA99189 and content ID UP9000-PPSA99189_00-VORTEXPS50000000.

`brand.json` owns the name, IDs, repository, release version, artifact names and retained artwork paths. `theme.json` owns semantic design tokens, reviewed mappings from upstream UI literals, and focus-specific token choices. Theme inspiration is [Seerr](https://github.com/seerr-team/seerr); the proposed palette is not claimed as official Seerr tokens. No Seerr assets or application code are copied.

| Role | Color |
| --- | --- |
| Canvas | #111827 |
| Secondary surface | #1F2937 |
| Elevated surface | #374151 |
| Accent | #6366F1 |
| Focus / information | #818CF8 |
| Primary / secondary text | #F9FAFB / #9CA3AF |
| Success / warning / error | #10B981 / #F59E0B / #EF4444 |

Strong focus halos use #A5B4FC to meet a 3:1 contrast threshold against every configured solid surface, including #4B5563. Primary button backgrounds use indigo #4F46E5 / #4338CA with white labels so normal text exceeds 4.5:1; the requested #6366F1 accent is retained elsewhere. Foreground text exceeds 4.5:1 on all configured surfaces. Secondary text is tested on canvas and secondary surfaces. These checks describe configured solid colors, not every animated frame or arbitrary game artwork.

`npm run prepare:vortex` verifies the complete selected source baseline, customized-file contracts and theme source hashes, then copies the application into ignored `.vortex/vortex`. It applies the existing independent updater safeguards, Vortex vector/name branding and semantic color substitutions. Original files are not recolored in place. All 73 original UI files containing literal colors are covered: navigation, catalog, detail, homebrew, search, filters, downloads, files, language/settings sheets, dialogs, buttons, focus rings, progress and status elements. Existing geometry, component hierarchy, handlers, focus scopes and controller navigation remain upstream's. Splash lifecycle, timing and animation callbacks are retained; only its vector marks/colors change.

Theme tests compare generated UI source with upstream after normalizing only color expressions and permitted branding. The contract gate rejects changed, added or removed color-bearing source files and unknown literal colors. A sync must fail for manual theme review instead of silently restoring upstream colors. Review each affected transformation before refreshing `theme-contracts.json` or `contracts.json`.

Catalog data, game artwork, provider identifiers and download rules are not recolored or rewritten. `app/data/`, the catalog/filter/release-cache modules and the selected framework remain exact upstream bytes. The provider key `overdrive cdn` and original catalog APIs are preserved. Independent title-specific persistence and application self-update policy remain Vortex-specific.

Existing required home-screen raster artwork is temporarily retained. Main UI Logo/Splash marks are text/vector source; no raster artwork is generated. Follow [ASSET_REPLACEMENT_GUIDE.md](../ASSET_REPLACEMENT_GUIDE.md) for manual replacements. License and contributor notices remain packaged.
