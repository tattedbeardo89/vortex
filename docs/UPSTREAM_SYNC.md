# Upstream synchronization

Daily/manual `.github/workflows/upstream-sync.yml` detects changes in MyLuxy/overdrive main and opens or updates a **draft integration PR**. It never changes main, force-pushes, auto-merges or publishes a release. Vortex release management remains separate in tattedbeardo89/vortex.

The authoritative selection is `custom/vortex/upstream-baseline.json`, initially published v1.0.8 at `9f90d882771eb87f75579b10f951cc2dbe4daf2a`. Git ancestry alone cannot establish the active baseline: Vortex intentionally selected an older published snapshot after investigating newer main's catalog. The sync compares the manifest's selected commit to upstream's tip.

An integration branch first merges current Vortex main normally; merge conflicts are aborted and reported without choosing a side. It then stages **one complete upstream application, framework and tooling snapshot** from the candidate commit, preserving Vortex's diagnostics, branding layer, workflow and packaging wrappers. The baseline manifest advances in that same candidate commit, including source version, application/framework tree IDs, catalog data tree, catalog module SHA-256, schema description and updater capability/compatibility version. This proposes a new baseline; it does not activate it in main or installed builds.

Vortex never independently generates a commercial catalog. There is no Vortex commercial ingestion workflow. A newer bundled catalog cannot enter the selected app through a separate catalog-only sync. If a future selected upstream version supports runtime catalog updates, preserve its exact consumer, feed, schema validation, version gate and next-launch behavior. Its compatibility version must be `UPSTREAM_VERSION`, not Vortex's release `VERSION`. Published v1.0.8 has **no runtime catalog-update consumer**, so stale/newer saved catalog caches are not read and no consumer is added to this build.

The candidate runs overlay/baseline validation, theme/source contracts, catalog/homebrew parity, independent updater tests, application tests and retained historical catalog diagnostics. The reusable validation workflow also builds native PS5 output and runs framework checks. Unreviewed UI/theme or updater changes fail closed; hashes are never automatically refreshed. The report includes the previous and candidate source/catalog revisions and failing checks. Read-only validation has no release permissions. Existing draft PRs and integration branches are reused with ordinary fast-forward pushes; repeat runs at the same revision make no new source changes.

## Review a candidate

1. Check the candidate upstream commit and source version against the selected baseline. Review upstream changes outside app/framework/tools (including packaging and newly introduced workflows) explicitly; Vortex wrappers remain custom integration points.
2. Confirm that application and catalog data advance together. Inspect updated schema/consumer behavior and ensure a runtime feed cannot cross its upstream compatibility gate.
3. Review every changed theme/updater contract; adapt the overlay to the actual upstream code before refreshing that individual hash. Never mass-refresh contracts to silence errors.
4. Run `npm run test:vortex`, `npm run test:catalog`, `npm run test:app`, `npm run test:framework` and `npm run build:app`. The generated catalog must equal the candidate's real upstream catalog, not a fixed historical count. Review any native or framework failures.
5. Confirm Vortex name/theme, PPSA99189/content ID, independent release feed and artifact names. Review controller focus/navigation with the desktop preview and separately authorized hardware testing.
6. Mark ready and merge only after human review. Publishing a new Vortex release is a separate explicitly authorized operation.

For manual selection, use a regular feature branch. Restore `app`, `ps5-react` and upstream `tools` from the exact candidate commit while excluding `tools/catalog-diagnostics`; generate the matching baseline manifest using `baseline.describe`. Keep Vortex wrappers/configuration. Review contracts and tests as above. No worktree, reset or force-push is needed. Roll back through a normal reviewed revert, not a rewrite of main.

GitHub must allow Actions to create PRs. GITHUB_TOKEN-created PRs may not trigger ordinary pull_request checks, so the daily workflow explicitly invokes read-only reusable validation for the pushed integration commit. The initial implementation PR must be merged before the new daily behavior is active on main.

Framework test-only corrections are recorded in `custom/vortex/framework-test-overrides.json` and `overrides/framework-tests.patch`. Snapshot import reapplies them only to matching original source hashes. A changed upstream test/harness requires review, adaptation or removal of a now-obsolete correction. Baseline verification still rejects unapproved runtime/catalog drift and modified patched bytes. See investigations/framework-test-failures.md for the exact scope.
