# Vortex Web security

Vortex Web is disabled until explicitly enabled on the console. Configuration persists in the application's independent data directory (`vortex/web.json`); pairing codes, sessions and CSRF secrets remain in memory. Closing/restarting the app, disabling Web or changing listener configuration invalidates all sessions. No UPnP, router forwarding, internet access, external hosting or companion daemon is configured.

## Trust boundary

The listener accepts IPv4 RFC1918, loopback and link-local peers only. Default bind is `0.0.0.0` with peer filtering; console settings can restrict to loopback. Host must match the receiving socket's local IPv4 address and configured port (localhost is allowed only on loopback). Mutations require an exact matching HTTP Origin, JSON content type, a valid session cookie and CSRF header. Cross-site fetch metadata is rejected. Authentication covers every API except code pairing. Static shell assets reveal no application state. These checks do not rely on CORS.

HTTP does not encrypt traffic. A hostile party able to observe or alter LAN traffic can steal a pairing code/session or modify the frontend. Pair only on a trusted LAN, do not expose the port through forwarding/tunnels, and disable Web on untrusted networks. This design does not claim HTTPS confidentiality or resistance to a compromised console/browser. IPv6, arbitrary DNS hostnames and proxy forwarding are not supported.

## Credentials and abuse limits

Native randomness reads `/dev/urandom` or `/dev/random`, failing closed if unavailable; no pseudo-random fallback exists. Whether these device nodes work on the target PS5 must be verified on hardware. Pairing uses an eight-hex-character one-time code, expires after five minutes and consumes it on successful pairing. Bearer secrets contain 256 random bits; CSRF tokens derive from a domain-separated SHA-256 of that bearer. Session cookies are HttpOnly, SameSite=Strict, Path=/, Max-Age=2592000; HTTP cannot use Secure cookies. Sessions expire after 30 days of meaningful authenticated inactivity, at most 16 paired devices. Verifiers and validated activity timestamps persist outside the application image. Polling does not renew authorization; see PHASE5_PAIRING_BRANDING.md for checkpoint, clock and recovery policy. Revocation immediately removes access; delayed enqueue operations revalidate after asynchronous release resolution.

Pair attempts are limited to 5 per peer per minute and 20 globally; general requests to 180 per peer and 480 globally per minute, with bounded peer bookkeeping. Native transport limits 16 client slots, backlog 16, 8KiB headers, 16KiB body, 2MiB response, 10s request/20s response deadlines and bounded work per application tick. It rejects duplicate headers, ambiguous lengths, transfer encoding, Expect, extra/pipelined request bytes and unsupported methods. No request/token logging is added. Do not upload private development pairing files or console snapshots containing codes.

## Narrow operations

API download input selects existing catalog IDs, original associated releases and currently connected storage IDs. The original queue and provider validation still run. API replies omit provider URLs, request headers and raw paths; error URL text is redacted. Storage IDs remain stable across drive reorder and disappear from allowed destinations on disconnect. No generic file read/write, command execution, native-memory or arbitrary-download operation exists.

Frontend uses DOM text nodes for untrusted metadata, HTTPS-only remote artwork and a restrictive Content-Security-Policy. No third-party scripts, localStorage credential persistence or inline executable code is required. Remote artwork hosts still see the browser's network request. Authenticated users can trigger the supported console download/install capabilities unless read-only mode is enabled; pair only trusted devices.

## Verification boundaries

Automated tests exercise token/CSRF/Origin enforcement, expiry, revocation, rate limits, parser/size errors, socket clients, session isolation and upstream adapter contracts. Browser tests exercise real catalog data through the clearly identified development transport. Controlled queue tests are adapter tests, not PS5 downloads. PS5 entropy, OS sockets, storage actions, provider connectivity and lifecycle need hardware verification. Keep existing working artifacts and paired access disabled until that verification is satisfactory. Report implementation defects through the repository without posting tokens, pairing codes or signed artifact URLs.
