# Commercial catalog discrepancy investigation — 2026-10-21

## Finding and decision

Both reported console counts reproduce exactly using the real application modules, with no persistent catalog update and no browsing filters. Published Overdrive **v1.0.8** produces **1,148 = 1,009 PS5 + 139 PS4**. The source used by the tested Vortex build, and current upstream source, produce **2,105 = 1,123 PS5 + 982 PS4**. Vortex is not missing upstream's availability filter. No commercial filtering or catalog-data correction is justified; legitimate upstream additions are preserved.

The user confirmed the installed Overdrive version is **1.0.8** and reconfirmed both applications' counts. This establishes the installed-version difference, supported by exact source reproduction. Console cache files were not supplied and no additional console logs are needed to explain these counts.

## Provenance

| Snapshot | Commit | Catalog compatibility version |
| --- | --- | --- |
| Published upstream v1.0.8 | `9f90d882771eb87f75579b10f951cc2dbe4daf2a` | 1.0.8; no nightly catalog consumer |
| Tested Vortex image source | `7441739ec82dc90aa2864c9faea7ea004cb5fb8f` | upstream 1.0.9; Vortex app version 1.0.0 |
| Vortex upstream baseline | `7853000e5e10f19f8e05857529991c740c42ed08` | 1.0.9 |
| Latest upstream inspected | `c7e962db9a971a407f61d70473fade417de735ec` | 1.0.9 |

The upstream GitHub latest-release API identified v1.0.8, published 2026-10-20T21:06:50Z. “Current source” and “latest published application” are different snapshots.

The exact Vortex build is associated with [hosted validation run 39661047039](https://github.com/tattedbeardo89/vortex/actions/runs/39661047039), source commit above; the previously validated Vortex.exfat SHA-256 is `53aab0b19703eae010b12ac6e5a068a17097ed05f13c85e34ed5f6a634965756`. The binary currently installed on the user's console was not read back and hashed. The exact build source, its upstream baseline, and inspected upstream HEAD have byte-identical `app/data/catalog.js`, `app/state/catalog.js`, `app/state/catalog-update.js`, and `app/state/paused-hosts.js`. The Vortex overlay does not modify commercial data, catalog filtering, or pause rules. Its catalog updater changes branding, independent storage, and the version import to upstream compatibility version 1.0.9.

## Measured counts

Counts below describe primary commercial listings; edition records (`twins`) are separate, not added to the displayed total. “Eligible provider” means a declared provider passes `pausedFilter`, not a live download check.

| Primary listings | Overdrive v1.0.8 | Vortex / inspected upstream |
| --- | ---: | ---: |
| Bundled total | 1,729 | 2,491 |
| Bundled PS5 / PS4 | 1,061 / 668 | 1,152 / 1,339 |
| Own eligible declared provider | 1,148 | 2,083 |
| No declared providers | 533 | 366 |
| Only paused/disabled declared providers | 48 | 42 |
| Hidden total | 581 | 386 |
| Hidden PS5 / PS4 | 52 / 529 | 29 / 357 |
| Visible through another eligible edition | 0 | 22 (16 PS5 / 6 PS4) |
| Final visible total | **1,148** | **2,105** |
| Final visible PS5 / PS4 | **1,009 / 139** | **1,123 / 982** |
| Duplicate title IDs across both blocks | 0 | 0 |
| Bundled alternate-edition records | 221 | 421 |
| Retained alternate-edition records | 200 | 403 |
| Work groups containing both PS4 and PS5 editions, before filtering | 22 | 222 |
| Visible primary listings without own eligible release rows | 0 | 16 |
| Visible primary listings without any edition's eligible release rows | **0** | **0** |
| Applied nightly catalog update | none | none |
| Homebrew observed on console | 104 | 104 |

The 16 listings without their own eligible release rows are supported by another edition. Some own-provider metadata and release-row eligibility differ; the report explicitly measures both instead of treating metadata as proof of downloadability. All six PS4 listings retained by edition fallback have at least one edition with eligible release rows. A platform count describes the primary listing's platform; the offered downloadable edition may be on another platform.

Homebrew is loaded separately from `https://prosperostore.net/api/v1`, with its own cache. The 104 counts are the user's observations, not an independently fetched or bundled count. The offline report returns `homebrewCount: null` without a supplied cache. No homebrew code or data is changed.

## Why PS4 grows by 843

There are **957 added visible IDs and zero removed IDs**: 114 PS5 and 843 PS4.

| Added visible listings | PS5 | PS4 |
| --- | ---: | ---: |
| IDs absent from the old primary block | 91 | 671 |
| Previously present but hidden IDs | 23 | 172 |
| Total additions | **114** | **843** |
| Additions with own eligible declared provider | 98 | 837 |
| Additions retained through an eligible edition | 16 | 6 |

The 671 PS4 IDs are genuinely new primary IDs, not old twins promoted into the primary block: v1.0.8's only two PS4 twins have no providers and are not among the additions. Provider tags among the 843 added PS4 listings include AkiraBox (472), Vikingfile (433), FileKeeper (293), DataNodes (1), and disabled MediaFire (3). Tags overlap, so these are not additive game counts. AkiraBox, Vikingfile, FileKeeper and DataNodes are permitted by the inspected upstream policy; MediaFire alone never makes an entry eligible.

Source history isolates the increments:

| Source state | Visible PS5 | Visible PS4 | Total |
| --- | ---: | ---: | ---: |
| v1.0.8 | 1,009 | 139 | 1,148 |
| `c7653e4`: SuperPSX sources restore hidden PS4 listings | 1,009 | 248 | 1,257 |
| `a145bd3`: SuperPSX source attribution fix | 1,009 | 249 | 1,258 |
| `b8ac82f`: Pegasus / SuperPSX catalog imports | 1,110 | 982 | 2,092 |
| `e95c344`: paused primary may use another edition | 1,123 | 982 | 2,105 |
| Vortex source and inspected latest upstream | 1,123 | 982 | 2,105 |

Thus **109 + 1 + 733 = 843 PS4** additions arise before the edition-policy change. Applying the old policy to current data still gives 982 PS4 (and 1,110 PS5). The subsequent policy change adds 13 PS5 listings and **zero PS4** on current data. Applying the newer policy to old data gives 1,157, not 2,105. Catalog imports and newly assigned providers dominate the discrepancy.

The additions are legitimate under current upstream's eligibility rules. No host was probed for file existence, accessibility, or a successful console download; that stronger availability claim remains unverified.

## Filter, updates and persistent state

`app/state/catalog.js` loads a compatible saved update first, then builds the set of works with an eligible edition. It removes primary entries with no eligible provider unless another edition of the work is eligible. Alternate entries without an eligible provider are removed unconditionally. Screens consume these filtered arrays. `release-cache.js` separately removes release rows rejected by `pausedSource`. MediaFire is disabled; paused browser hosts remain excluded. Vortex and upstream share these rules.

The release's older policy only permits edition fallback for an empty provider list, whereas current policy also permits it for a paused-only primary. This is an intentional upstream change, not an accidental Vortex bypass. Primary title IDs are unique; alternate editions are not blindly counted a second time.

Both current upstream and Vortex use `https://raw.githubusercontent.com/MyLuxy/overdrive/catalog/catalog-update.json`. Vortex reads and writes `<its title data directory>/vortex/catalog-update.json` and its ETag; Overdrive uses its own title directory and `/overdrive/`. They do not share persistence. Vortex deliberately validates against `UPSTREAM_VERSION` (1.0.9), not branded app version 1.0.0. Updates are kept for the next launch, checked structurally and for exact compatibility version, then applied before filtering; named IDs replace either block, removed IDs disappear, and release/page overrides apply together. Different saved caches/settings can therefore change device counts even with equivalent bundles.

The public feed retrieved during this investigation reports `format: 1`, `base: e95c344647128e7db3194e22abcdb2c6165cba90`, `generated: 2026-10-21T16:44:23Z`, one game, no removals, three release overrides and one page override. It lacks the required `version` field. Both inspected consumers reject it; testing this feed leaves visible counts unchanged. This shared upstream publication/schema mismatch can prevent nightly updates, but is not the cause of the observed 957 difference. It should be resolved by upstream publishing a compatible feed, rather than Vortex accepting unversioned updates. A previously kept valid cache could differ; neither console cache was inspected.

## Reproduction and tests

Requires Git history, Python 3.12+, Node 22+, and the existing React dependency (`npm ci --ignore-scripts --prefix ps5-react`). A fresh fork checkout may not contain the newer upstream documentation commit:

```sh
git fetch --no-tags https://github.com/MyLuxy/overdrive.git c7e962db9a971a407f61d70473fade417de735ec
npm run diagnose:catalog
npm run test:catalog
```

The default full JSON is `.vortex/catalog-comparison.json`: source hashes and commits, platform counts at each stage, hidden/paused/source-less categories, duplicate IDs, cross-platform work groups, release-row eligibility, update application/logs, complete per-ID before/after records, and exact added/removed IDs. The compact committed [measured summary](catalog-discrepancy-summary.json) records the investigation snapshot. To inspect future upstream changes, pass `--upstream upstream/main`; the default is pinned for reproducibility.

```sh
npm run diagnose:catalog -- --catalog-update /path/to/copied/catalog-update.json --output .vortex/with-cache.json
npm run diagnose:catalog -- --homebrew-cache /path/to/copied/homebrew.json
```

Only use copies of console cache files. Diagnostics deliberately prohibit HTTP and filesystem mutations; even malformed cache quarantine attempts are blocked. Source extraction includes only JS/JSON text; no binary images are generated. Supplied catalog caches are evaluated separately against each snapshot's real compatibility rules. A supplied homebrew cache is processed by that snapshot's real homebrew loader.

Six regression tests cover exact historical counts/deltas, source and result parity with upstream and the working application, empty/paused provider exclusion and edition fallback, release-row availability across editions, uniqueness/twins, the old/new policy matrix, and version-gated cache removal before filtering. Hardcoded counts exist only as historical assertions, not catalog or application logic. CI fetches the pinned upstream commit, runs diagnostics/tests, and uploads the full report.

## Outcome for the installed build

No runtime code or commercial data change is needed. For the tested bundle with no applied update and default filters, expected counts remain **2,105 total, 1,123 PS5, 982 PS4**. Equivalent Overdrive source/data/state produces the same result; published v1.0.8 naturally produces 1,148. Homebrew remains independent.

The existing tested **Vortex.exfat does not need replacement for this discrepancy**. This PR adds diagnostics, regression coverage and documentation only. Vortex branding, PS5 identity, updater, automatic upstream synchronization, and homebrew behavior remain intact. No release is published. A replacement would be warranted only for a separately established runtime issue or a deliberate future update, not to force the count to 1,148.
