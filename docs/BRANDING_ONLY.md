# Branding-only v1.0.8 implementation

The user intentionally selected the published Overdrive v1.0.8 baseline after [PR #2's investigation](investigations/catalog-discrepancy.md) established that newer upstream catalogs are legitimate. This is version parity, not a new availability policy.

## Exact revisions and parity

- Upstream release/source: **v1.0.8**, commit `9f90d882771eb87f75579b10f951cc2dbe4daf2a`.
- Application Git tree: `07fc5dab5f57ffbf4646b13f6df106953203025d`.
- Framework Git tree: `9d0fa31212204414f673724c3bba5f6d4213eb57`.
- Catalog data Git tree: **`e6f05a52c7909f56ad70f1868543192ce083e1d9`**.
- Catalog module SHA-256: `2b2abc88c8665b28407c9032b61dd39b08d993a87f66c9cc88b1f0738a4ced07`.
- Vortex release version: **1.0.1**, independently versioned.
- Bundled schema: upstream JavaScript catalog plus release/page JSON; upstream has no separately numbered bundled schema. Schema version is recorded as null, not invented.
- Runtime commercial catalog updater: **absent in v1.0.8**, exactly as upstream. No compatible cache is required to reproduce the console counts.

The original source trees match the pinned upstream version byte for byte. Disposable output changes only branding/colors, title-specific identity/state namespace, packaged attribution and independent self-update infrastructure. The selected catalog, provider eligibility, edition logic and release-row filtering are untouched.

| Measured result | Upstream v1.0.8 | Generated Vortex |
| --- | ---: | ---: |
| Raw primary commercial listings | 1,729 | 1,729 |
| Visible commercial listings | **1,148** | **1,148** |
| Visible PS5 | **1,009** | **1,009** |
| Visible PS4 | **139** | **139** |
| Hidden primary listings | 581 | 581 |
| Retained alternate editions | 200 | 200 |
| Visible without any edition's eligible release rows | 0 | 0 |
| Homebrew, recorded real API manifest | **104** | **104** |

The real homebrew API fixture contains 113 records; upstream excludes nine `coming_soon` records. Its URL, retrieval time, source commit and SHA-256 are recorded in `custom/vortex/tests/fixtures/homebrew-provenance.json`. This is test data only; production still uses the unchanged live service/cache behavior. Neither catalog is frozen to these counts. Download hosts were not probed for live file availability.

`npm run test:vortex` verifies identity, updater safeguards, source/theme contracts, real homebrew records, UI structure/colors/contrast and generated commercial parity. `npm run diagnose:catalog` writes `.vortex/catalog-parity.json`, reporting upstream source/catalog revisions and real-module counts. Override `--catalog-update` or `--homebrew-cache` to evaluate copied console state; v1.0.8 correctly ignores commercial update caches because it has no consumer. `npm run test:catalog` and `npm run diagnose:catalog-history` retain PR #2's newer-catalog evidence and old/new policy tests.

## Theme and synchronization

See [BRANDING.md](BRANDING.md) for the Seerr-inspired semantic palette and contrast checks. All original color-bearing UI source files are covered without navigation/layout changes. Game art remains untouched. See [UPSTREAM_SYNC.md](UPSTREAM_SYNC.md) for daily draft PRs that advance complete source/catalog snapshots together and fail on incompatible theme/update contracts.

## PR handling and artifacts

PR #1's identity, updater, build pipeline, attribution and synchronization safeguards are retained. PR #2's investigation, pinned historical tests and reports are retained with an explicit historical note. This implementation is a new PR against main containing the complete reviewed Vortex layer and the deliberate baseline selection; it supersedes the older initial-baseline proposal, without closing or merging either earlier PR automatically. Merge this implementation as a unit; merging the older PRs afterward could reintroduce stale assumptions.

The new Vortex.exfat and update.zip are built as review artifacts, not published releases. They must replace the previous newer-baseline Vortex image to obtain the requested initial 1.0.8 parity. Exact artifact/run hashes and validation are recorded in the PR once the hosted build completes. Console execution is not established for this new image; no console deployment is performed.

Home-screen icon/background raster art remains temporarily upstream's. Supply manual replacements through [ASSET_REPLACEMENT_GUIDE.md](../ASSET_REPLACEMENT_GUIDE.md); text/vector UI branding is present. No PNG/JPG/DDS/WEBP assets are generated.
