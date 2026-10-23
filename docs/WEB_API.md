# Vortex Web API v1

Same-origin HTTP JSON under `/api/v1`. Except pairing, every API route requires the HttpOnly `vortex_session` cookie. Non-GET routes require `Content-Type: application/json`, the exact HTTP Origin and `X-Vortex-CSRF` returned by pairing/session lookup. There is no CORS authorization mechanism or bearer token in URLs. JSON responses use `Cache-Control: no-store`. Invalid inputs fail rather than providing filesystem/native access.

| Method | Path | Contract |
| --- | --- | --- |
| POST | `/auth/pair` | `{code,name}`; returns `{apiVersion,csrf,expires}` and session cookie. Code comes only from console. |
| GET | `/auth/session` | Current CSRF token, absolute expiry and read-only state. |
| POST | `/auth/activity` | `{}`; CSRF-protected meaningful user activity; sliding 30-day authorization. Polling/GETs do not renew. |
| POST | `/auth/logout` | `{}`; revoke current device and expire cookie. |
| GET | `/status` | Vortex version, selected source baseline, commercial counts, cached homebrew count and development flag. |
| GET | `/dashboard` | Original featured/popular games, latest releases, actual queue and storage. |
| GET | `/facets` | Original catalog facets and sorts, with labels. |
| GET | `/catalog` | `q`, `sort`, facet keys, `favorites=1`, `page`, `limit`; original eligible commercial entries. |
| GET | `/homebrew` | `q`, `category`, `page`, `limit`; refresh through existing homebrew loader. |
| GET | `/game?id=…` | Existing game, original editions and releases, favorite ID/state. No provider credentials or download URLs. |
| GET | `/favorites` | Shared wishlist entries. |
| POST | `/favorites` | `{id,wished:boolean}`; explicit, idempotent shared wishlist update. |
| GET | `/downloads` | Existing queue jobs with actual state, bytes, total, speed, redacted error and supported actions. |
| POST | `/downloads` | `{gameId,editionId?,releaseId,storageId}`; validate membership/availability/current storage, recheck authorization after asynchronous resolution, enqueue using original engine; 202 `{id}`. |
| POST | `/downloads/action` | `{id,action}`; whitelist `pause`, `resume`, `cancel`, `openBrowser`, `install`, `register`, gated by actual job state/capability. |
| GET | `/storage` | Stable opaque destination IDs, labels, total/free bytes for currently allowed roots. IDs last for the adapter lifetime. |
| GET | `/settings` | Listener configuration, non-secret device metadata/current device ID, `consoleManaged:true`. |
| POST | `/devices/revoke` | `{id}`; revoke paired device, including self. |

Catalog page defaults to 1, limit to 24; limit 1–60, page 1–10000. Sort/facet values must be advertised by `/facets`. Repeated query keys and malformed encodings fail. No arbitrary URLs, paths, shell commands, memory or filesystem endpoints are accepted. Only `/`, `/index.html`, `/app.js` and `/styles.css` are public static paths. Unsupported routes/methods return 404.

Error responses have `{error:string}`. Typical status codes: 400 invalid input, 401 pairing/session failure, 403 Origin/CSRF/read-only/access failure, 404 missing item/route, 409 queue action/development-transfer restriction, 413 size limit, 415 wrong content type, 429 rate limit, 500 operation failure. An advertised provider is eligible under upstream rules, not independently verified reachable.

Polling clients should pause when hidden, back off on transport failures and re-pair on 401. Mutations are not retried automatically. Disconnection does not cancel an already accepted queue operation. Read-only mode rejects mutations except logout; pairing itself remains available with a console-generated code.

Native transport contract is private ABI 1 at `__vortexWebNative`: `start`, `stop`, `random`, `poll`, `reply`. It is consumed only by the Vortex adapter, not exposed over HTTP. Upstream core ABI remains unchanged. The development transport shares routing/authentication but explicitly rejects downloads and has no PS5 state connection.

Explicit authorization failures return HTTP 401 with `code: PAIRING_REQUIRED`; network, timeout, ambiguous errors and HTTP 5xx must not clear browser credentials.
