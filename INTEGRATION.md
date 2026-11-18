# Backend and Flutter integration

The frontend includes the supplied Player API adapter and an isolated mock adapter. Current endpoint and host-bridge details are in [README_BACKEND.md](README_BACKEND.md). Development now defaults to the reachable LAN Player API, and production defaults to the API adapter. `?mode=mock` and `?screens=1` provide offline review. `?mode=api` explicitly selects API mode.

## System ownership

The SONO app vendor hosts the miniapp frontend and integrates it in Flutter. The owner's game-service server owns sessions, game services, logs and ranking. SONO core owns SP balances, debit/credit and financial actions. Flutter supplies a short-lived launch assertion and performs native authentication/approval. The current client interface is `window.SonoBridge.getLaunchToken()` and `payWithPoints({orderId})`.

## Current client guarantees

The client serializes authentication refresh, keeps game-service credentials in memory, preserves idempotency keys and frozen operation payloads across retries, and prevents overlapping unresolved life orders. Order state is rechecked with the server, including a restored pending reference. A cached PAID label cannot settle a payment. Repeated finish calls share one captured score/duration submission. Background/exit invalidates a pending start and finalizes its resulting run once.

Displayed points stay distinct from trusted score authority. API FINISHED means that the supplied Player API recorded a result. The frontend leaves `verifiedScore` unset because SEC-02 trusted verification is still owned by the backend. The mock has its own sample ledger, standings and history. Its approval sheet contains a visual keypad plus a simulation button.

The latest Player API has 15 paths and includes `GET /api/v1/birds` and `PUT /api/v1/me/bird`. The catalog supplies tournament total and each bird's unlock/selected status. `birdCatalog` in the service interface carries this metadata to Store. The API selection call returns a Promise and the UI applies the confirmed server choice. Local artwork IDs map `pilot` → `sono`, `santa` → `santa_sono`, `gold` → `goldy_sono`.

## Remaining backend and native work

Finalize SEC-02 and the authoritative session lifecycle, including one active run per account, replay handling, timeout and background termination. Reconcile server-issued speed/config values with BRD V2.1. Align the current local-dev bird thresholds 0/50/150 with BRD V2.1 thresholds 0/1,500/3,000 in backend configuration. API views follow the server's actual catalog. Wire the newly supplied `/api/v1/lives/history` into the frontend. Supply daily/previous standings, personal score history, SP balance and prize metadata for the remaining views. See [the UI API list](docs/UI_API_REQUIREMENTS.mn.md).

Connect native token exchange and payment approval on physical iOS/Android WebViews. The core callback must settle orders on the game-service server before the UI reports paid rights. Financial ledger delivery, reward eligibility, deduplication and reconciliation remain server-owned. Earned-right expiry requires the authoritative tournament lifecycle.

The existing security and release controls remain recorded in [docs/SECURITY_SPEC.md](docs/SECURITY_SPEC.md). Use [the vendor agenda](docs/VENDOR_INTEGRATION_AGENDA.mn.md) for the unresolved contracts and [implementation evidence](docs/IMPLEMENTATION_STATUS.md) for the completed client checks.


The frontend now emits content-hashed runtime assets and `release-manifest.json`. Deploy/cache examples and the pending backend Redis plan are in [the cache/performance guide](docs/CACHE_AND_PERFORMANCE.mn.md). Static Home/settled Game Over rendering sleeps; active gameplay and effects keep rendering. `?perf=1` adds development-only local timing diagnostics. Actual VPS/Nginx configuration and physical Flutter profiling remain host integration tasks.
