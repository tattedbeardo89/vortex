# PR #3 framework test investigation

Target: `feature/vortex-branding-only-v108`, originally `e029afdf5f0afbc6956aa7382baddcd13eaa393a`. Selected upstream: Overdrive v1.0.8, `9f90d882771eb87f75579b10f951cc2dbe4daf2a`.

## Evidence and access limits

The original [job 119565508447](https://github.com/tattedbeardo89/vortex/actions/runs/39699652451/job/119565508447) ran commit `e029afdf5f0afbc6956aa7382baddcd13eaa393a`. Direct storage downloads were blocked by the cloud proxy. A scoped GitHub-runner diagnostic retrieved its actual archived log in [run 39842620631](https://github.com/tattedbeardo89/vortex/actions/runs/39842620631/job/120047767623); notices preserve the final excerpt. It confirms **136 tests, 134 passed, 2 failed, 0 skipped**, stopping at the JavaScript runner on 2026-10-22 at 00:29:54 UTC.

The original runner prints only the last 6,000 characters of its failed subprocess log (`tools/common.py:run`). Those contain later passing cases and totals; the two earlier assertion messages were never included in the archived job log. Consequently the exact failure names/assertions below are established by reproduction of the exact source, not falsely attributed to an original CI log that omitted them. This limitation cannot be recovered from that historical log. CI now prints complete framework subprocess logs in a failure-only follow-up step; it does not change the failing test step or job outcome. The Actions Node-version deprecation warning is unrelated.

The original full local runner reproduced **134 passed / 2 failed**. The native test file alone reproduced **10 passed / 2 failed**. Running the original LAN test alone passed.

## Exact causes

1. **`browser capture delivers only its result and cancellation rejects as AbortError`**, original `runtime/js/native.test.mjs:336`: the expected native call had three arguments. Actual: `['https://vikingfile.com/d/', '/Game.pkg', 180, [], false]`. The wrapper, native implementation and NATIVE-API.md already specify five arguments: prefix, suffix, timeout, rejected links, resume. Those last two options are legitimate upstream functionality. This is a stale test expectation, not a Vortex branding change or runtime browser-capture defect.
2. **`a LAN broadcast resolves with its replies, and an abort cancels it`**, original line 369: `TypeError: tick is not a function`. The prior assertion fails after registering browser task 1. Its finally block restores global mocks but leaves that task and the shared network polling timer registered. LAN task creation therefore reuses the existing timer instead of calling the LAN test's replacement setInterval, so its local tick is never assigned. This is cascading test-fixture state contamination, not evidence that LAN broadcasting is broken. Standalone LAN success establishes the distinction.

The relevant upstream files were byte-identical before the correction. Both failures reproduce outside GitHub Actions; the Node deprecation annotation is not their cause.

## Minimal behavioral corrections

The browser test now checks all five default arguments, explicitly checks nondefault rejected/resume options, and retains its original progress, listener, completion and cancellation assertions. It additionally verifies polling stops after completion and cancellation. Finally cleanup drains fixture-owned pending terminal results before restoring timer/host mocks.

A negative regression deliberately breaks a copy of the capture assertion in a separate Node process and verifies exactly that test fails while the following LAN test still passes. No original test is deleted, skipped or changed to accept incorrect runtime behavior. Production native.js and the native browser/LAN implementation remain unchanged.

## Further Linux harness issues exposed by running the entire suite

Passing JavaScript tests allows previously unreached native checks to run. Direct local compilation confirmed missing EVP/libcrypto linkage in the standalone network client and the image fixture's unconditional macOS malloc/malloc.h dependency. The original archive runner also failed on this rootless machine because it hardcoded /usr/bin/bsdtar.

- Network/image test binaries explicitly link Linux libcrypto, matching network.cpp's existing implementation.
- The image fixture preserves macOS malloc-zone injection and uses GNU linker wrapping on Linux to inject the same allocation failures into test-object calls. Shared library allocation remains independent; exhaustion assertions are retained.
- The video test target links Linux static FFmpeg's OpenSSL/zlib dependencies, matching the already-correct production preview target. Production target linkage is unchanged.
- Archive tests prefer the existing normal bsdtar installation and fall back to the executable on PATH. Missing bsdtar remains a hard error; no archive case is skipped.

The network server also had two timing assumptions exposed by complete execution. Adaptive concurrency could drop before the fixture injected all three required transient statuses; the fixture now deterministically injects 500, 503 and 429 even with serial requests, verified by a separate regression. A fixed 180 ms cancellation could occur before any full range was durably completed. The validator-less resume scenario now cancels at a completed 1 MiB boundary through a test-client-only option and asserts that progress before changing the server bytes. Original retry/status, mutation rejection, and byte-equality assertions remain intact.

These are test-harness/platform corrections. They do not alter production download, image, video, catalog, updater, branding or theme behavior.

## Source baseline and upstream synchronization

The original source/catalog descriptor remains pinned. `framework-test-overrides.json` records original and corrected SHA-256 values for seven explicit test/harness files; `overrides/framework-tests.patch` records their exact diff. baseline.verify permits only those exact corrected bytes after verifying the matching original upstream blobs. All other runtime/catalog source drift remains an error. Tests reject modified overrides, unknown upstream input and attempts to allow native.js through the manifest.

Snapshot synchronization reapplies the patch only when all original source hashes match. An upstream integration that changes these contracts is marked for review and fails baseline validation rather than silently dropping the corrections. Already-fixed upstream tests should be reviewed and the corresponding overrides retired. The original framework ABI, host installation hooks and runtime JS remain byte-identical, preserving PR #4's Web integration contracts.

## Validation status

- Corrected native JavaScript file: 12/12 passed.
- Override/isolation regression tests: 6/6 passed, including intentional-assertion-failure isolation.
- Existing Vortex: 18 Python tests and 8 JavaScript tests passed, including baseline/theme/catalog/updater checks. Application: 17 passed. Historical catalog: 6 passed.
- Framework JavaScript: all 136 passed. Native resources, removals, networking, images, text, video, passthrough and browser matcher passed independently.
- PR #4 compatibility: temporary local combined candidate `14b2fe60a63e1ffb67605df53441c56f54030d8a` (PR #3 `3986399` plus PR #4 `910fd93`) passed 20 JavaScript and 8 Python Web tests, frontend build, and actual QuickJS/C++ pairing/assets/catalog/favorites/queue/logout/shutdown checks. No download or console hardware claim. Neither PR was merged.
- Full local runner was executed without suppression. After 136 passing JavaScript tests and resources, the archive wide-7zip fixture hit the unchanged production memory-pressure guard. Direct measurement: committing its decoder memory took 3,696 ms on this machine, exceeding the existing 1,000 ms limit. The guard and archive assertions remain unchanged. This is a local resource-timing limitation, not a claimed full-suite pass.
- Starter rendering/input self-test and worker parity passed separately: 3 snapshots identical single-core and across render workers. Hosted full-suite validation for the corrected framework source: [run 39842620631, framework job](https://github.com/tattedbeardo89/vortex/actions/runs/39842620631/job/120047767346). The final hosted result is tracked in the PR description; this report does not claim a local full-suite pass. Identity/application checks and native PS5 build passed in that run.

No merge, release or console deployment is part of this work. No new artwork is added; the original framework suite creates its own temporary test fixtures.
