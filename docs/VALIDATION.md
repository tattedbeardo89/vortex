# Vortex implementation validation

Validated in the prepared Linux cloud environment. No PS5 was contacted or deployed to, and no binary artwork or screenshots were generated for this implementation.

| Check | Result |
| --- | --- |
| Vortex Python regression tests | 5 passed: identity, incompatible upstream source rejection, new branding drift, conflict abort, preserved customization and repeated-merge idempotence |
| Vortex JavaScript regressions | 8 passed: release origin/version/digest selection, archive identity, independent install lookup, real updater success/failure handling, override rejection, independent catalog compatibility version |
| Existing application state suite | 46 passed, 1 pre-existing skip, 0 failures |
| Complete npm test | Fails at original framework tests: 136 passed, 2 inherited failures; not suppressed |
| Workflow validation | All workflow YAML parsed; actionlint v1.7.7 passed |
| Native Vortex build | npm run build:app passed for PPSA99189; Vortex name, content ID and 01.000.000 version verified |
| Native integrity | Existing framework verification passed title metadata, icon, ELF structure, SELF integrity, hashes and folder ZIP; Vortex resource notice and receipt identity verified |
| Desktop identity/navigation | Main UI contained “Vortex v1.0.0”, 119 focusable elements; Down changed focus from spotlight CTA to a catalog card |
| Desktop features | Search opened its keyboard/results; settings opened speed/package/vibration and language options; downloads displayed idle state and Browse games action |
| Development refresh | Actual theme edit regenerated the overlay and restarted the preview; restoring the original theme restarted it again; original bytes restored |
| Original source preservation | app/, ps5-react/, covers/ and dependency locks unchanged from the audited baseline |
| Artwork | No newly added/modified binary artwork; editable text SVG placeholder only; original home-screen files retained |
| Synchronization | Local Git fixtures exercised non-destructive merges and conflicts; live upstream read access verified. Hosted scheduled workflow not yet exercised |
| exFAT/update.zip packaging | Not executed locally: this machine lacks sudo/root/mount access. Manual Ubuntu workflow configured to produce and validate them |
| Native PS5 execution/update/coexistence | Not tested; title ID is structurally valid and locally distinct, not globally reserved |

Inherited framework failures: browser-capture test expects three host arguments while the implementation sends five; its early failure leaves timer state that breaks the following LAN test. The LAN test passes alone. Additional baseline Linux-only limitations of independent native suites are documented in BUILDING.md. These are not disabled; the read-only validation workflow runs the original framework suite and will expose its failures.

The ZIP/manifest update logic has mock-backed regression coverage, not a successful console image replacement test. Packaging and mounted-image semantics require the hosted/root-capable build and hardware review. Game/homebrew provider downloads and remote artwork requests were not exercised end-to-end; original service definitions and identifiers were retained. GitHub Actions execution and PR creation are external operations whose outcomes must be reported separately from these local checks.
