# Angular V branding and durable browser authorization

This change starts from merged main because no Phase 5 branch or open PR existed. Earlier sidebar/download-failure requirements were not included in the supplied supplement; their details have been requested. Existing native layout, download engine, providers, catalog, theme and updater remain intact.

## Original artwork

`custom/vortex/branding/angular-v.svg` is the editable, original two-segment Angular V master. Indigo/violet polygons form the mark without a font character, surrounding square or tagline. Browser branding/favicon and native logo/splash geometry derive from that same master. The splash retains upstream mounting, animation completion and fade timing.

`branding.py` deterministically generates the transparent 512×512 PNG home icon and 3840×2160 BC7 DX10 DDS backgrounds with pinned Pillow, during the protected Vortex overlay. Generated binaries are not committed. `VORTEX-BRANDING.json` records the master digest, platform dimensions and file digests. Packaging verifies that manifest and each packaged file, alongside the browser/native Web manifests. Upstream imports cannot replace this protected directory; incompatible source hooks still fail validation. No third-party artwork is used.

## Authorization lifetime and activity

An authorization expires at `lastActivity + 30 days`, with at most 16 devices. A 256-bit CSPRNG bearer stays in the browser's HttpOnly, SameSite=Strict cookie; persisted records hold SHA-256 token verifiers, IDs, names and validated timestamps. CSRF tokens derive from the bearer using a separate `:csrf` domain and are not written to disk. CSRF, Origin/Host validation, local-network restriction, request limits, pairing rate limits and async enqueue revalidation remain enforced.

Only successful authenticated POST operations renew activity. The browser sends a CSRF-protected `/auth/activity` request for trusted pointer/keyboard input, at most once per five minutes. Catalog reads, queue/favorites polling, session checks, server maintenance, page refresh alone, failed operations and rejected requests do not renew. An abandoned background tab therefore expires even if it polls continuously. Successful user operations refresh the cookie's 30-day Max-Age.

Native state lives at `${FileSystem.dataDir}/vortex/web-devices.json`, alongside existing writable Vortex configuration, outside `/app0` and the replaceable exFAT image. Closing/reopening Vortex, listener configuration changes and process reconstruction reload the same records. Disabling Web stops access without revoking devices. Explicit logout, device revocation or a console security reset revoke access.

## Persistence, clocks and recovery

Pairing and revocation commit immediately using a synced temporary file and atomic rename. Activity updates live in memory immediately and checkpoint at most once per five minutes; graceful service shutdown flushes them and checkpoints the clock without renewing inactive devices. Abrupt process termination can lose up to five minutes of recent activity, conservatively shortening authorization rather than extending it. No maintenance timer writes or renews activity.

The PS5 system wall clock is the available time source. Integer/range checks, a persisted clock high-water mark and a five-minute rollback tolerance guard timestamps. Small backward changes clamp to the high-water mark; larger rollback/invalid clocks stop authorization with a service error until corrected. Forward jumps expire devices conservatively. No unauthenticated client supplies the security clock.

A leftover temporary file never overrides committed authorization. No old backup is used after revocation. Corrupt, oversized, duplicate, future-invalid or incomplete initial state fails closed. Correct console time/storage first. The console-only **Reset all browser authorizations** recovery control replaces unusable state, intentionally revokes every browser and requires fresh pairing; it is not an HTTP recovery endpoint. A failed persistence operation is reported, not acknowledged as a durable pairing/revocation. If storage fails during revocation, access is denied in the running process, but the operator must repair/reset persistent storage before relying on revocation across restart. Filesystem rename/durability under sudden PS5 power loss requires hardware verification.

## Offline is not expired

The browser displays **“Vortex is offline. Reopen Vortex on your PS5 to reconnect.”** for unreachable/timeout/5xx failures, retains cookies and session state, and retries with exponential delay capped at 30 seconds. A visible Reconnect control retries immediately. Only explicit server `401` with `code: PAIRING_REQUIRED` opens pairing. Ambiguous errors never erase authorization; signing out also requires a successful server response.

## Validation and device scope

Controlled-clock/isolated-storage tests cover expiry, renewal, non-renewing polling, failed requests, corrupt state, interrupted writes, persistent revocation, bounded sessions and module reconstruction. Browser tests stop/restart the real development process with the same persistent store and cookie, assert offline rather than pairing, and cover startup 503 recovery. The actual native QuickJS/HTTP probe exercises the generated integration; PS5 packaging is configured to verify the new icon, backgrounds, SVG favicon and native Web assets.

Physical PS5 app switching, rest mode, reboot, clock changes, real device storage durability and controller appearance still need hardware verification. No console deployment or release publication is performed automatically.

Stopping a listener also invalidates its in-flight authorization object without deleting durable devices. Old async resolutions cannot enqueue through a stopped generation; a new listener reloads the same unrevoked device verifiers.
