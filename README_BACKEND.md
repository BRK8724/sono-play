# Player API integration

For a standalone, removable server-free preview, see [local mock mode](docs/LOCAL_MOCK.mn.md). It is enabled only by `VITE_LOCAL_MOCK_API=1` plus `?mock=1` and never calls the Player API.

The frontend uses the supplied Player API contract in `docs/api/player-openapi-2026-11-18-ui-audit.json` and the November 19 Postman update in `docs/api/flappy-player-api-2026-11-19.postman_collection.json`. The Postman update adds daily standings, available tournament days, bird catalog/selection, and life history; these are wired through `src/services/ApiMiniappService.ts`. The development-only grant route is omitted from the vendor OpenAPI copy. `src/services/ApiClient.ts` handles authenticated requests and idempotency keys. `src/services/HostBridge.ts` obtains the launch token from Flutter; the browser app does not store core credentials.

The stats screen fetches `GET /api/v1/leaderboard?limit=10` for the total tab, `GET /api/v1/leaderboard/daily?limit=10` for today, and `GET /api/v1/leaderboard/days` for the calendar. Selecting a calendar date fetches `GET /api/v1/leaderboard/daily?day=YYYY-MM-DD&limit=10`. Score rows with `reachedAt` display that time in Asia/Ulaanbaatar; rows without it display only the API's day.

Game start returns the run ID, seed, paid-with method, remaining rights, and authoritative physics configuration. The client uses that configuration for display and play, then submits the result once at game over. The API validates and persists it. The client never submits individual taps or grants points, lives, skins, or prizes.

A confirmed finish can include `newlyUnlocked` bird codes. The client refreshes `GET /api/v1/birds`, displays the new names in an unlock panel, and lets the player open the catalog. It never unlocks a bird from the local score alone.

The purchase flow uses the Player API order state and optional native `SonoBridge.payWithPoints` confirmation. Retried purchase requests reuse their order idempotency key. The frontend refreshes the order state and displays confirmed server status only.

For load, security, CORS, and release questions see [production architecture and open decisions](docs/DECISIONS_AND_GAPS.md), [security specification](docs/SECURITY_SPEC.md), and [vendor integration agenda](docs/VENDOR_INTEGRATION_AGENDA.mn.md).
