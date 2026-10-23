# Vortex Web architecture and investigation

Selected baseline: PRs #3 and #4 are merged; Phase 5 starts from main `13c462e`. Upstream remains Overdrive v1.0.8, `9f90d882771eb87f75579b10f951cc2dbe4daf2a`, data tree `e6f05a52c7909f56ad70f1868543192ce083e1d9`. No catalog or provider changes are part of this extension.

## Orbit evidence, before implementation

Inspected saawant12/orbit-store-ps5 commit `174b24123a455380d4eb4c9bf5b0f5d2a86e80bf`, README, guides/getting-started.md and tracked-file inventory. Its public repository contains documentation, encrypted catalogs and release metadata, not HTTP/frontend/queue implementation source. No implementation license grant is present. No Orbit code, assets, encrypted data or binaries are adapted.

Documentation confirms a separate `orbit_store.elf` service, optionally started by the native title through an ELF loader on port 9021. The native and browser interfaces share a service/catalog/queue; that service can outlive the TV app. Docs describe browser pairing and service restarts. Static asset handling, internal HTTP routing, worker/concurrency strategy and exact authentication implementation cannot be established from published source and are **unknown**, not inferred as verified facts. Vortex uses only the general shared-state/browser-access concept.

## Framework evidence and selected design

ps5-react uses QuickJS/Embedded React, not Node or a browser. Its ABI v19 offers outgoing HTTP/download tasks, native worker queues, LAN UDP queries, filesystem and lifecycle hooks. It has no public listening HTTP/WebSocket module. Native desktop control already uses nonblocking sockets; the SDK supplies POSIX socket declarations. SDK declarations and cross-compilation are not hardware evidence. HTTP request handlers cannot touch QuickJS from a worker thread.

Implement an original, Vortex-only nonblocking IPv4 HTTP listener in the same process. Bound client slots, request/response sizes, deadlines and per-poll work keep socket operations cheap. A private `__vortexWebNative` ABI passes bounded requests/responses through a render-thread timer. All JavaScript handlers run on the existing application thread, using the existing catalog, favorites, homebrew loader, storage roots and downloadQueue singleton. There is no second manager, scraping service, payload, Node dependency or background daemon. The browser polls authenticated state. Closing Vortex terminates the server; it must remain open for network access. Device authorization persists outside the image for a sliding 30-day inactivity window, so reopening reconnects without pairing.

The original framework retains the selected upstream snapshot plus PR #3’s exact reviewed test-harness corrections. A disposable framework overlay adds one reviewed host installation hook and the Vortex native header. App overlays add only the web lifecycle/settings control and narrow state accessors; original provider/queue/catalog rules remain untouched. Exact source-hash and replacement-count contracts fail closed when upstream changes. The private extension ABI is separately versioned; the upstream ABI is not redefined.

CSPRNG bytes must come from the OS; startup fails closed if unavailable. No weak-random or unauthenticated fallback exists. The service is disabled until enabled locally. Network peers and Host/Origin are constrained; authenticated mutations require a session and CSRF secret. See WEB_SECURITY.md for details and plain-HTTP trusted-LAN limitations.

Production uses the in-process native transport and real state adapter. The Node development transport is separately named and explicitly marks development mode; it exercises the same router and real bundled catalog with a non-downloading development queue. Mock networking never becomes the PS5 transport. Native socket tests, router integration tests, browser tests, desktop preview and cross-build results are reported separately from later physical PS5 tests.
