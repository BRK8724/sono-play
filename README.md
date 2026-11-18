# Flappy SONO frontend

The frontend follows the supplied Fine Gold design and BRD V2.1. It includes the playable Phaser game, 34 review states, and the Player API integration for profiles, games, orders and server-owned bird selection. The latest Swagger has 15 paths; its newly added life-history endpoint still needs frontend wiring.

## Run

Use Node.js 22.18+.

```bash
npm install
npm run dev -- --port 5177
npm run check
```

Open `http://localhost:5177/` for the API-connected game. Development uses the LAN Player API at `http://192.168.1.196:8080`. Enter a nickname, then tap or press Space to flap. Collision or backgrounding ends a run. Open `?mode=mock` for the independent offline fixtures when the backend is unreachable.

Open `http://localhost:5177/?screens=1` for all 34 screens. Each card opens its interactive state with its own fixture. `?screen=buy-two` opens a two-life purchase example. `&embed=1` hides review navigation for screenshots. The board uses static WebP thumbnails and loads a game only when a screen is opened.

`?mode=api` explicitly selects the Player API integration. Development and production default to API mode. `?mode=mock` and screen routes select fixtures. See [README_BACKEND.md](README_BACKEND.md) for API paths, host bridge and environment configuration. The latest screen-by-screen requirements are in [the UI API list](docs/UI_API_REQUIREMENTS.mn.md).

## Current rules and fixtures

- Three free rights daily at 00:00 Asia/Ulaanbaatar, spent before earned rights.
- Twenty sample SP buys one new-run right. Mock approval changes the in-memory balance only.
- One cleared pipe pair gives one displayed point. BRD V2.1 and the mock unlock Santa at 1,500 cumulative points and Goldie at 3,000. API Store uses the server catalog's `unlockScore`, `unlocked` and `selected`, and waits for `PUT /api/v1/me/bird` before applying a selection. The current local-dev catalog uses 0/50/150, which requires backend configuration alignment with BRD 0/1,500/3,000.
- Speed increments by 0.1 at cumulative 10, 25, 45, 70… pairs in the offline preview. API runs use server-issued configuration.
- Entry time chooses day from 07:00 to 18:00 and night otherwise.
- Standings provide overall, today, previous day and personal sample history. Overall ranking uses the mock service, sample rows start in `src/mock/uiFixtures.ts` and update through the in-memory service after play, purchase and daily rollover.

`src/mock/fixtures.ts` holds initial sample balances and catalog data. `src/mock/MockMiniappService.ts` contains the in-memory ledger. `src/preview/screens.ts` defines each review state. The UI consumes the shared `MiniappService` interface.

## Rendering and production cache

Home and settled Game Over render once and sleep; Ready and Playing keep their animation loop. Collision smoke finishes before the loop sleeps. Repeated Ready entry reuses the current background textures, and viewport signals are coalesced before collision updates.

Development `?mode=mock&perf=1` enables local FPS/frame-time diagnostics. `window.__SONO_PERFORMANCE__.snapshot()` and `.reset()` expose a bounded sample window, rendered-frame and background-build counters. The diagnostic has no telemetry and is removed from production builds. Physical Flutter device profiling remains a release task.

Every build gives runtime images, fonts and thumbnails content-hashed URLs through `src/assets.ts` and `build/runtime-assets.mjs`. `dist/release-manifest.json` records source mappings, output checksums and the release ID. New runtime artwork must be registered in that build module. Original source art stays outside the production output. Deploy the whole `dist/`, retaining old hashed assets for open WebViews and rollback. See [the cache/performance guide](docs/CACHE_AND_PERFORMANCE.mn.md) and [Nginx template](deploy/nginx.conf.example). Backend Redis integration and target-server cache headers require the backend/hosting team.

## Design and remaining work

The supplied Mogul Square font and existing artwork are used. The FLAPPY SONO wordmark, Fine Gold sponsor, footer icons, rank characters and gold-prize art are individual exports from the requested Fine Gold Figma section. Source-node mappings are in `design-reference/figma-fine-gold/runtime-manifest.json`. Night gameplay uses a preview tint pending final artwork. Gifts contain sample prize art. The native confirmation sheet contains a visual keypad and an explicit simulation button.

Bird catalog and selection are connected through `GET /api/v1/birds` and `PUT /api/v1/me/bird`. The vendor's physical Flutter WebView, real native payment callback, daily/history APIs and trusted score/reward validation still require integration testing. The frontend has no financial reward authority. Detailed decisions and verification are in [docs/DECISIONS_AND_GAPS.md](docs/DECISIONS_AND_GAPS.md) and [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

The required asset files, current API endpoints, proposed missing data contracts, Flutter bridge and Play/Core ownership are listed in [the handoff requirements](docs/REQUIRED_FILES_AND_CONNECTIONS.mn.md).
# sono-play
