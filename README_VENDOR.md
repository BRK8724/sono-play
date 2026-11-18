# Flappy SONO frontend handoff

This is the standalone Vite + Phaser miniapp opened inside the SONO Flutter WebView. Its source is in `src/`, the required asset compiler in `build/`, runtime artwork/fonts in `public/`, and the current Figma node mappings in `design-reference/figma-fine-gold/runtime-manifest.json`.

Current product rules follow the supplied BRD V2.1 dated 2026-11-17. Current visual elements come from the `Тоглоом fine gold` Figma section, node `168:9379`. Mogul Square is bundled in the web build. The game uses its supplied two-part logo, sponsor mark, footer icons, rank characters and prize art.

## Build and host

Use Node.js 22.18 or newer.

```bash
npm ci
npm run check
npm run build -- --base=/sono-play/
```

`npm run check` verifies Prettier, the automated tests, strict TypeScript and the production build. Deploy the entire `dist/` directory at the chosen HTTPS path. Replace `/sono-play/` in the build command if another path is used. The WebView URL must end in that directory path. Revalidate `index.html` and `release-manifest.json` across releases. Runtime images/fonts/thumbnails and JS/CSS have content-versioned paths and can use long-lived immutable caching. Keep old hashes available for already-open WebViews and rollback. The [cache/performance guide](docs/CACHE_AND_PERFORMANCE.mn.md) and [Nginx template](deploy/nginx.conf.example) define the proposed layout and headers.

Development defaults to the LAN Player API. Production defaults to the API adapter. `?mode=mock` opens offline fixtures and `?screens=1` opens 34 isolated review states. `?mode=api` explicitly selects the Player API adapter. See [README_BACKEND.md](README_BACKEND.md) for origin/CORS configuration and endpoints.

## Flutter integration

The proposed hosting paths, launch/payment request flows and remaining responsibilities are in [the production deployment guide](docs/PRODUCTION_DEPLOYMENT.mn.md).

- Open the hosted miniapp URL in the WebView with the agreed native navigation controls.
- Provide `window.SonoBridge.getLaunchToken()` for the short-lived game-service token exchange. Core credentials remain in the native/core layers.
- Provide `window.SonoBridge.payWithPoints({orderId})` for native approval when real payment integration is ready. The game waits for the Player API's final order state. The visual PIN preview uses an explicit mock button.
- Provide `window.__SONO_SAFE_AREA__ = {top,right,bottom,left}` in CSS pixels and dispatch `sono-safe-area` after changes. Insets can fall back to browser environment values.
- Ensure app backgrounding or WebView destruction terminates a run through the agreed server lifecycle. The client handles `visibilitychange` and `pagehide`, including an in-flight start response arriving after exit/background.
- API sessions check connectivity every 30 seconds and on browser network events. Offline mock sessions make no connectivity probes. A dedicated authoritative heartbeat/timeout protocol remains a backend integration item.
- Apply the production WebView and delivery controls already approved in `docs/SECURITY_SPEC.md`.

## Rules and isolated fixtures

Three free rights reset at 00:00 Asia/Ulaanbaatar without carryover and are spent before earned rights. A sample 20 SP buys one new-run life. Santa opens at cumulative 1,500 points, Goldie at 3,000, followed by Store activation. The V2.1 speed sequence increases at cumulative 10, 25, 45, 70… pipes in the mock. API games use the server's issued config.

`src/mock/MockMiniappService.ts` holds the in-memory wallet, standings, daily score history and life ledger. `src/mock/fixtures.ts` and `uiFixtures.ts` supply sample initial data. Reloading resets the mock account. `src/preview/screens.ts` defines each isolated screen state. A skin activation in the mock preserves the SP balance. API Store reads `GET /api/v1/birds` and awaits `PUT /api/v1/me/bird` with `{code}` for selection. Catalog fields `unlockScore`, `unlocked`, `selected` and tournament total come from the server. The client maps `pilot` to `sono`, `santa` to `santa_sono`, and `gold` to `goldy_sono`.

The current local-dev catalog unlocks the three birds at 0/50/150 points. BRD V2.1 and offline fixtures use 0/1,500/3,000. Reconcile the backend environment configuration before using the BRD milestones for a tournament. A new tournament can lock birds again and the server selects the default until the saved choice unlocks.

## Remaining integration

The latest Player API has 15 paths, including bird catalog, persisted selection and the newly supplied `/lives/history`. Life-history adapter/pagination wiring remains. Native launch/payment callbacks, daily/previous standings, personal score history, SP balance and prize metadata require vendor/backend integration. See [the UI API list](docs/UI_API_REQUIREMENTS.mn.md). The current Player API records submitted results, while trusted score verification and financial reward eligibility remain backend responsibilities. Physical iOS/Android WebView testing and production load/security verification remain pending.

Final night/theme artwork and dedicated Santa/Goldie wing-pose layers remain asset gaps. The current night tint and those skins' body motion are preview treatments. See [docs/DECISIONS_AND_GAPS.md](docs/DECISIONS_AND_GAPS.md) for owners and current status.


## Performance verification

Static Home and settled Game Over sleep after a completed render; Ready/Playing and active collision effects remain animated. Background layers are reused until their theme or dimensions change. Resize signals are coalesced before physics. In development, `?mode=mock&perf=1` shows bounded local frame diagnostics; it is removed in production. Verify cold/warm load, frame time, JS/GPU memory and app lifecycle on physical Flutter devices. The supplied Nginx file is a template awaiting target-host `nginx -t` and real header checks.
