# Vortex branding

`custom/vortex/brand.json` is the source of application name, description, release repository, title/content IDs, Vortex version, artifact names, volume label, theme and artwork paths. Vortex 1.0.0 is independent of upstream 1.0.9. The generated PS5 content version is 01.000.000. IDs must match the framework schema and each other. Changing an installed title ID creates another installation; do not change it for routine releases.

`npm run prepare:vortex` copies app/ into ignored `.vortex/vortex`, checks every customized source against contracts.json, applies reviewed patches, copies runtime overrides and generates metadata. A second run with unchanged inputs changes no bytes. No source file under app/ or ps5-react/ is edited. Change upstream files normally when developing functional improvements, then deliberately review/refresh only affected contracts before rebuilding.

The two patches remove feed overrides and harden the original updater while retaining its download checksum, extraction, staging, cleanup and atomic image-replacement behavior. Custom components provide a text Logo and timed Splash without raster artwork. The theme keeps the original palette keys; edit brand.json.theme to change shared colors. Existing inline styles remain compatible, so theme customization does not promise to recolor every upstream literal.

Locale values are rebranded in the generated app, not translation keys. Provider key `overdrive cdn`, its real service name, catalog URLs and dependency references remain functional and unchanged. User-facing update/manual recovery URLs use the Vortex repository. Title-specific persistent queue paths and update work directories are independent; generic Vortex data directories are inside the new title's own dataDir. There is no automatic import or deletion of Overdrive state.

Review assets configuration and ASSET_REPLACEMENT_GUIDE.md for manually supplied home-screen files. SVG placeholders are editable source only. VORTEX-NOTICE.txt is included as a packaged resource, in addition to framework/dependency notices. Small root build/setup/workflow/README integration changes are intentional merge review points.
