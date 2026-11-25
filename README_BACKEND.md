# Player API integration

The frontend follows the production Player API contract in `docs/api/flappy-player-api.json`, derived from the backend export without development-only routes. Refresh it after every API change. Calls are wired through `src/services/ApiMiniappService.ts`; `src/services/ApiClient.ts` handles authenticated requests and idempotency keys; `src/services/HostBridge.ts` talks to the SONO app ([host bridge](INTEGRATION.md#host-bridge)). The browser app does not store core credentials.

For a staging host, the `Dockerfile` builds this client into an nginx image that serves `/sono-play/` and proxies `/api/v1/` to the backend on the same origin (`deploy/nginx.compose.conf.template`); the backend repository's `deploy/staging/docker-compose.yml` runs it together with the API, PostgreSQL and Redis.

To develop against a local backend, configure its HTTPS origin in `.env.local` and launch the game from a SONO host that implements `SonoBridge.getLaunchToken`. The production frontend has no local identity or test entitlement path.

The stats screen fetches `GET /api/v1/leaderboard?limit=10` for the total tab, `GET /api/v1/leaderboard/daily?limit=10` for today, and `GET /api/v1/leaderboard/days` for the calendar. Selecting a calendar date fetches `GET /api/v1/leaderboard/daily?day=YYYY-MM-DD&limit=10`. Score rows with `reachedAt` display that time in Asia/Ulaanbaatar; rows without it display only the API's day.

Game start returns the run ID, seed, paid-with method, remaining rights, and authoritative physics configuration. The client uses that configuration for display and play, then submits the result once at game over, and again with the same values if that attempt fails; the server accepts a late result. The API validates and persists it. The client never submits individual taps or grants points, lives, skins, or prizes.

Requests per game are kept low: the start and finish answers carry the remaining rights and the new totals, so the client reads `GET /api/v1/me` and `GET /api/v1/tournament` only when its copy is older than a minute or would stop the next game (no rights, no nickname, tournament over), and `GET /api/v1/birds` only after a finish that unlocked a bird. Nothing is called during a flight.

A confirmed finish can include `newlyUnlocked` bird codes. The client then refreshes `GET /api/v1/birds`, displays the new names in an unlock panel, and lets the player open the catalog. It never unlocks a bird from the local score alone.

The purchase flow creates the order (`POST /api/v1/lives/orders`, retried with the same idempotency key), opens the host's PIN screen with `payWithPoints({ orderId })`, and polls `GET /api/v1/lives/orders/{orderId}` until it is no longer `PENDING`. Lives appear only when the server says `PAID`. If the host answers `CANCELLED` or `FAILED`, or the player taps **БОЛИХ** while waiting, the order is forgotten on the device and expires on the server; a new order can be started at once. The point balance comes from the host's `getPointBalance`.

For load, security, CORS, and release questions see [open decisions](docs/DECISIONS_AND_GAPS.md), [security requirements](docs/SECURITY_SPEC.md), and [production deployment](docs/PRODUCTION_DEPLOYMENT.mn.md).
