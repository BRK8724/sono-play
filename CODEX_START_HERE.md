# Flappy SONO clean vendor handoff

This folder is the standalone, API-connected Flappy SONO WebView client. It contains the game/UI source, Player API adapter, runtime artwork/font assets, vendor integration notes, OpenAPI contract, and deployment examples. Mock player data, screen-gallery screenshots, copied design archives, tests, Git history, and installed dependencies are excluded.

## Start and build

1. Use Node.js 22.18 or later.
2. Copy `.env.example` to `.env.local`; set `VITE_API_BASE_URL` to the Player API HTTPS origin, or leave it blank behind same-origin routing.
3. Run `npm install`.
4. Use `npm run dev` only for development. A regular browser without SONO host launch credentials cannot sign in.
5. Run `npm run build` to validate TypeScript and generate the production bundle in `dist/`.

The production host must provide `window.SonoBridge.getLaunchToken()`. If native payment is enabled, it must also provide `window.SonoBridge.payWithPoints({ orderId })`. Keep PIN handling and Core credentials in SONO Core/native code.

## Key files

- `src/main.ts`, `src/Frontend.ts`: game loop and app UI.
- `src/services/ApiMiniappService.ts`, `ApiClient.ts`: Player API operations, idempotency, and result flow.
- `src/services/HostBridge.ts`: Flutter host boundary.
- `build/runtime-assets.mjs`: production asset hashing and release manifest.
- `README_BACKEND.md`, `docs/PRODUCTION_DEPLOYMENT.mn.md`: integration and deployment.
- `docs/SECURITY_SPEC.md`, `docs/DECISIONS_AND_GAPS.md`: security constraints and unresolved decisions.
