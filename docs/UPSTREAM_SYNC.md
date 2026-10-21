# Upstream synchronization

The permanent upstream is https://github.com/MyLuxy/overdrive, branch main. Vortex's release repository is https://github.com/tattedbeardo89/vortex. Enable Actions and allow GitHub Actions to create pull requests in repository settings. The daily/manual upstream-sync.yml workflow needs contents:write and pull-requests:write only in its sync job; no release permissions or external long-lived token is required.

The workflow fetches complete history, creates or resumes `integration/upstream`, merges origin/main, then upstream/main using ordinary merges. Pushes must fast-forward. It never resets main, force-pushes, auto-merges or publishes. Repeated execution reuses the same branch and open draft PR. When upstream is already in main, it does nothing. A concurrency group serializes runs.

An unresolved Git merge is aborted without choosing either side. The integration branch gets a conflict report, and its draft PR identifies the required manual review. Successful merges still need source-contract validation, overlay generation/idempotence tests, updater regression tests and existing app tests. Changes to custom/vortex, workflow/build integration or documentation also explicitly require review, even if Git merges them cleanly. Failures are recorded in `.github/upstream-sync/status.md`; the workflow exits unsuccessfully after creating/updating the review PR. Separate read-only pull-request validation builds the PS5 application without publishing.

## Review a synchronization PR

1. Inspect upstream changes, the merge result and status report. Preserve functional improvements and required copyright notices.
2. Resolve conflicts manually. Never choose all of upstream or all of Vortex indiscriminately.
3. If source contracts fail, inspect each changed upstream file against the corresponding transformation, replacement component or patch. Adapt the Vortex layer to new behavior before refreshing that file's SHA-256 in custom/vortex/contracts.json. Do not regenerate every hash to silence checks.
4. Run `npm run test:vortex`, `npm run test:app`, and `npm run build:app`. Run relevant framework checks for rendering/input changes; report pre-existing failures rather than bypassing them.
5. Confirm title/content identity, repository, Vortex version and artifact naming. Catalog compatibility must use generated UPSTREAM_VERSION, not Vortex's independent VERSION. Inspect manual/runtime update behavior and preserved services.
6. Mark the PR ready and merge only after acceptable checks and human review. If updates are desired for users, separately bump Vortex's version and run the manual release workflow.

For a manual integration, fetch both remotes, create a regular branch from Vortex main, and merge upstream/main. Do not create a separate worktree unless wanted. Run overlay.py --check before generation. Sync tests simulate ordinary merges, conflict aborts, preserved Vortex files and an unchanged second integration. A successful test is not proof that every future upstream revision will be compatible; source contracts deliberately require review.

Rollback a broken integration by reverting its merge commit (git revert -m 1 <merge>) on a review branch, not resetting published main. If a closed integration branch remains after merging/abandoning a PR, delete it through normal branch management before starting a different manual integration. GitHub's GITHUB_TOKEN-generated PRs may not trigger other workflows automatically: dispatch Vortex validation on the integration branch when necessary, or configure an approved GitHub App token if automatic follow-up checks are required. Sync's own checks still execute.
