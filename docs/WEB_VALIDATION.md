# Vortex Web validation record

Implementation build source: `1f2fbbd77026a4da4320e23138213bb0ff669da6`, stacked on PR #3. Later documentation and development-watcher locking changes do not change the compiled production extension. The final native build includes the modal shortcut guard. Upstream stays v1.0.8 (`9f90d882771eb87f75579b10f951cc2dbe4daf2a`); catalog tree `e6f05a52c7909f56ad70f1868543192ce083e1d9`. Raw app/framework sources remain unchanged.

| Check | Evidence |
| --- | --- |
| API, auth and service lifecycle | 20 JavaScript tests passed: actual upstream catalog modules, adapter command validation, session/CSRF/Origin/expiry/revocation, delayed enqueue revocation and stale responses across restart. Queue command tests inject a controlled queue, not PS5 downloads. |
| Native HTTP and compatibility | 8 Python tests passed: compiled C++ TCP transport with concurrent clients, malformed requests, disconnects and exact upstream compatibility rejection. |
| Commercial parity | 1,148 total: 1,009 PS5, 139 PS4. Original filtering, paused providers and editions remain upstream-owned. No count forcing or new catalog. |
| Homebrew fixture | 104 visible apps from the recorded real API manifest, excluding coming-soon entries. Live/cache counts may change. |
| Existing Vortex checks | 12 Python and 8 JavaScript regressions passed, including theme, identity, updater and synchronization, plus selected-snapshot parity. |
| Historical catalog/app regressions | 6 historical diagnostic tests and 17 existing application tests passed. |
| Local browser | System Chromium passed actual browser pairing, catalog/PS4 filters, details, favorites, homebrew, settings, responsive tablet/phone widths, offline/reconnect, cookie reload and logout. Development transport explicitly rejects console transfers. |
| Hosted browser | Initial implementation web-extension job passed, including Chromium, Firefox and WebKit flows. Final source web/API tests and frontend build passed; its browser installation/rerun is in progress. Frontend/router/auth inputs are unchanged since the initial browser run. |
| Actual native application | Passed against the desktop QuickJS app and C++ listener with SDL offscreen/Mesa: static assets, pairing, commercial filters, shared favorites, real queue reads, invalid enqueue rejection, logout and shutdown. No transfers or hardware claims. |
| Native PS5 image/update | Hosted native-build job passed, including packaging and verification of Vortex.exfat/update.zip; physical execution is unverified. |
| Original framework | Local runner: 134 passed, 2 failed (136 total). The inherited browser-capture argument mismatch and following LAN test remain exposed. The original CI job is not suppressed. |
| Workflow/static checks | actionlint and git diff whitespace checks passed; no new raster assets or raw upstream changes. |

## Hosted artifacts

[Validation/image run 39803377858](https://github.com/tattedbeardo89/vortex/actions/runs/39803377858) built `1f2fbbd77026a4da4320e23138213bb0ff669da6`. Download [Vortex-native-validation](https://github.com/tattedbeardo89/vortex/actions/runs/39803377858/artifacts/12436168778) for Vortex.exfat, update.zip, identity/update metadata, receipt and provenance reports. GitHub reports archive SHA-256 `d5b5356dafe03d7e3af13bb47a48984c90fbe32d4ac6d479c1d2984f5a924d72`, size 55,163,033 bytes; this is the outer artifact ZIP digest, not the inner exFAT digest. The hosted packaging verification passed. Independent local artifact download/inspection was blocked by a Forbidden response from the cloud proxy; no local byte-level image inspection is claimed.

[Initial web frontend/provenance artifact](https://github.com/tattedbeardo89/vortex/actions/runs/39798912516/artifacts/12433979184) contains the text frontend assets and web build report. Download URLs require GitHub access and artifacts expire according to repository retention. No public release, merge or console deployment was performed.

## Hardware and network limits

Verify secure OS entropy, native listener behavior, assigned LAN IP, concurrent clients, console focus/lifecycle, actual storage, provider-assisted transfers, pause/resume/cancel, install/register and self-update on a physical jailbroken PS5. An eligible provider entry is not proof of reachability. HTTP requires a trusted LAN. The old image cannot host the native Web extension: a new image/update is required for a later manual test.

Orbit's public repository did not expose the requested server implementation; documented architecture was recorded and no implementation or assets copied. The development Node server, standalone socket tests and actual native application checks are separate forms of evidence. No mock transfer is described as a PS5 operation.

The X11 preview failed intermittently at SDL initialization in this cloud machine. The supported offscreen SDL driver completed the native application regression without an X server or raster output: `SDL_VIDEODRIVER=offscreen npm run test:web:native`. For a cached compiled preview, the harness supports `--no-build`; rebuild after any production source change. The automated validation workflow now runs this check after the original framework suite with `if: always()`, so inherited failures remain visible while native Web behavior still gets exercised.

The final hosted framework job ran the actual native Web regression successfully despite the original suite failure. Its [native application report](https://github.com/tattedbeardo89/vortex/actions/runs/39803377858/artifacts/12436383275) is separate from the Node development transport. Local final-source full build/preview regression also passed with SDL offscreen. The development watcher now takes the generated framework build lock before refreshing staging.
