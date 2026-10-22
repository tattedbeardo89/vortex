# Vortex Web

Vortex Web adds a browser interface to the existing Vortex process. It is disabled by default. Keep Vortex open: there is no companion payload or service that survives closing the application. This implementation has automated desktop tests and a PS5 cross-build; physical PS5 operation still requires verification.

## Connect and pair

1. In Vortex's top navigation, open **Web**, then **Enable Vortex Web**. If startup reports an error, resolve it before connecting. The listener refuses to run without secure OS randomness.
2. Find the PS5 IPv4 address under **PS5 Settings → Network → Connection Status → View Connection Status**.
3. On Windows, open Edge, Chrome or Firefox on the same trusted LAN. On iPhone, join that Wi-Fi and open Safari. Enter `http://<PS5 IP>:34189`, for example `http://192.168.7.9:34189`. Use the actual address; DHCP may change it.
4. Enter the one-time code displayed by Vortex and a browser name. Codes expire after five minutes and can only be consumed once. Generate another code on the console for each additional browser.

Sessions expire after one hour and are lost when Vortex closes or the listener restarts. Use **Web → Revoke …** on the console or **Settings → Revoke** in a paired browser to remove access. Logout revokes the current session. Console controls can enable read-only mode, select LAN/loopback binding and change the port. Configuration changes revoke all browser sessions. The browser cannot enable the service or change its listening configuration.

## Browse and manage

Dashboard, commercial catalog, homebrew, favorites, downloads and settings use the existing application state. Commercial filters, sorting, alternate editions and release eligibility come from the selected Overdrive modules. Favorites use the console's persisted wishlist. Download commands enqueue into the existing singleton; pause, resume, cancellation, browser-assisted steps and install/register actions appear only when the underlying queue state permits them. Select a currently connected storage destination and a listed release. Browser access does not prove a provider is reachable, bypass provider restrictions or create an additional download engine.

The selected v1.0.8 catalog has no date-added field. The dashboard therefore labels its chronological shelf **Latest releases**, rather than inventing recently-added dates. Completed items are those retained by the existing queue; this feature adds no independent download history. Homebrew availability can change with the upstream API/cache.

The browser polls while visible, backs off on errors, and reconnects after a brief interruption. Accepted downloads continue through the existing application when the browser disconnects. An expired/revoked session needs pairing again. Progress, speed and errors are actual queue values, not simulated transfers.

## Troubleshooting

- Confirm Vortex remains open, Web reports running, both devices share a LAN, the IP/port are current and guest Wi-Fi/client isolation is disabled.
- Select private LAN binding for another device; loopback permits only local connections. IPv6, public peers and hostnames are intentionally unsupported. Enter the numerical IPv4 address.
- A port conflict requires a different port using console **Port +/−**, then the matching URL. No automatic port fallback changes your URL silently.
- Re-pair after a console restart or configuration change. A consumed/expired code must be regenerated. Repeated attempts are rate-limited; wait a minute before retrying.
- Empty storage or unavailable releases must be resolved in the existing Vortex application. Browser error messages conceal provider URLs.
- Do not forward the port or expose it through a tunnel. Plain HTTP requires a trusted local network; see [security](WEB_SECURITY.md).

## Development and verification

Run `npm run build:web`, `npm run test:web` and `npm run test:web:browser`. Browser tests require `npm ci --prefix custom/vortex/web` and `npx --prefix custom/vortex/web playwright install --with-deps chromium firefox webkit`. To use an existing local Chromium, set `VORTEX_BROWSER_PROJECTS=chromium VORTEX_CHROMIUM_EXECUTABLE=/usr/bin/chromium`.

`npm run web:dev` is an explicitly development-only Node transport bound to 127.0.0.1. It uses the actual generated commercial catalog and a recorded homebrew manifest, a private mode-600 `.vortex/web-dev-console.json` pairing-code file, RAM-only favorites and no console downloads/storage. Read the code locally without committing or uploading that file. This server does not host PS5 state and is not a substitute for the native listener. Production has no Node dependency.

Before deployment, verify on a jailbroken PS5: secure entropy access; TCP bind/accept/reply and private peer addresses; browser asset loading; controller focus and clean shutdown; concurrent paired clients; native provider-assisted downloads and queue controls; actual storage/install/register operations; favorites persistence; self-update and reinstall recovery. See [build instructions](BUILDING.md). No release or console deployment is automatic.
