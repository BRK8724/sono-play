# Standalone mini app

The project is a Vite/TypeScript Phaser game embedded by the SONO Flutter app. Flutter owns app identity and native confirmation. The Player API owns game sessions, rights, orders, catalog state, verification, and persistence. The WebView renders the game and sends only session start/finish and explicitly required account/order requests.

`ApiMiniappService` adapts the HTTP contract to the frontend. `ApiClient` attaches the host launch token and idempotency headers. Phaser runs a deterministic simulation using the seed and config returned by the server. The on-screen count remains display-only until backend verification returns a status.

Deployment and open trust-boundary decisions are described in `PRODUCTION_ARCHITECTURE.mn.md`, `SCALE_200K_ARCHITECTURE.mn.md`, `docs/SECURITY_SPEC.md`, and `README_BACKEND.md`.
