# Player API integration

The frontend uses the supplied Player API collection and `/v3/api-docs/player` schema. The latest 2026-11-18 contract has 15 paths and is [stored locally](docs/api/player-openapi-2026-11-18-ui-audit.json). The earlier 14-path snapshot is retained separately. Run `npm run dev -- --port 5177` and open `http://localhost:5177/?mode=api`. Development defaults to API mode again as of 2026-11-18. It connects to `http://192.168.1.196:8080` using mock launch tokens. A random test-user identifier is retained in local storage, so reloads use the same backend player. API credentials remain in memory. The API TEST menu can grant five mock lives and open the order flow.

`http://localhost:5177/?mode=mock` opens the independent in-memory UI fixture adapter. `?screens=1` opens all offline review states. Neither uses the LAN backend.

## Host integration

Production builds use the Player API at the same origin by default. Set `VITE_API_BASE_URL` at build time when the API has a separate HTTPS origin. That origin must permit the frontend's origin and the `Authorization`, `Content-Type` and `Idempotency-Key` headers through CORS.

The host supplies `window.SonoBridge` with these asynchronous methods. `window.bridge` is also accepted for the names used by the supplied collection.

```ts
interface SonoBridge {
  getLaunchToken(): Promise<string | { launchToken: string }>;
  payWithPoints?(request: { orderId: string }): Promise<unknown>;
}
```

The launch token is exchanged for game-service credentials. Refresh-token rotation is serialized across concurrent 401 responses. If refresh fails or is unavailable, the adapter obtains a fresh launch token from the host and retries once. Core credentials, PIN entry and HMAC signatures belong to the host and servers.

On BUY, the game creates an order with the quantity and a stable idempotency key. The host receives its `orderId`. The game polls the Player API for the final order state and refreshes the server-owned play balance after PAID. A pending order reference is scoped to the backend player and retained in session storage for reload recovery. Browser tests without a payment bridge show the pending state. The core callback must complete the debit flow before payment success can be verified.

## Gameplay and results

The run response supplies gravity, jump velocity, scroll speed, pipe gap, spawn interval, speed thresholds and seed. The API game uses those values. The in-memory demo follows the V2.1 cumulative speed schedule with separate preview physics. Pipe positions use a seeded Mulberry32 generator with an FNV-derived 32-bit state, preserving the server's int64 seed digits. The backend schema does not specify a generator algorithm for replay verification.

Finish captures score and monotonic duration once. Retries reuse that payload. Server FINISHED and REJECTED states are displayed separately. An accepted Player API score is recorded as a server response, while `verifiedScore` remains unset because this API provides timing-bound validation rather than a replay-verification contract. Reward and loan operations remain server-owned.

Leaderboard reads are cached for one minute and requested when Stats opens and once per minute while its dialog is visible. Pending-order polling backs off while waiting and suspends network polling in a hidden page. Active games check backend connectivity every 30 seconds and on browser connectivity events. Backgrounding ends gameplay and sends its result. The current backend has no dedicated heartbeat or background-termination endpoint.

## Server-owned bird catalog

The current Swagger adds `GET /api/v1/birds` and `PUT /api/v1/me/bird` with `{ code }`. The adapter maps `sono` to Pilot, `santa_sono` to Santa and `goldy_sono` to Goldie. Store reads the server's names, unlock thresholds, ownership and selection; activation awaits the server response. `me.selectedBird` restores the selection after reload. Initial profile load, Store open, completed games and tournament changes refresh the catalog. Ordinary connectivity checks do not fetch it. Catalog failures leave Store retryable without fabricating ownership or blocking profile/game initialization. Unknown bird codes show an artwork-pending card and use the supplied Pilot texture for gameplay until their art is available.

The live `local-dev` tournament on 2026-11-18 supplies Santa at **50** and Goldie at **150** cumulative points. BRD V2.1 requires **1,500 / 3,000**. API screens follow the backend configuration; the isolated mock retains V2.1. The backend owner must align the production configuration before release.

Live browser checks passed launch exchange, nickname save/reload, profile/tournament/price reads, catalog reads, default-bird PUT, locked-bird handling, two actual runs, overall ranking and a pending life order. The 0- and 2-pipe runs consumed one free play each; the 2-point total and selected bird survived reload. A one-life order cost 20 SP and stayed PENDING without the native/core callback. No financial approval or reward callback was invoked.

## Remaining integration work

- Connect and test the vendor's actual launch-token and payment bridge on iOS/Android.
- Verify PAID, FAILED and EXPIRED transitions through the core callback service.
- Wire the newly supplied `GET /api/v1/lives/history?limit=50` into the frontend, including `entries`, `freePlays`, `tournament` and cursor pagination. The repeated `freePlays` array must not be appended again on each page. Supply SP balance, prize metadata, daily/previous standings and personal score history APIs. Bird ownership and selection are integrated. Background selection remains local, and Gifts prize artwork is a design example.
- Finalize trusted score verification before enabling financial rewards.
- Verify deployment HTTPS, CORS and WebView settings with the vendor's hosting origin.


The detailed current UI data requirements, existing/missing APIs and host responsibilities are in [the UI API list](docs/UI_API_REQUIREMENTS.mn.md). The payment failure popup also needs a stable order/native failure reason, since `FAILED` alone does not distinguish insufficient points from other failures.
