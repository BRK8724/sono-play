# Flappy SONO Mini App

Standalone Flutter WebView game client. The Player API is authoritative for account, entitlement, catalog, and score operations. The SONO Flutter host supplies a one-time launch token through `SonoBridge`.

## Local development

1. Install Node.js 22.18 or later.
2. Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the Player API HTTPS origin, or leave it blank when `/api/v1/*` is proxied on the game origin.
3. Run `npm ci`, then `npm run dev -- --port 5177`.
4. Open the app inside the SONO host bridge. A regular browser without the host launch token cannot authenticate.

`npm run build` runs TypeScript validation and creates the production web bundle. `npm run preview` serves that bundle locally.

## Production connection

`VITE_API_BASE_URL` is fixed during the build. An empty value sends requests to the game origin's `/api/v1/*` route; the hosting gateway must proxy that route to the Player API. A separate API origin must use HTTPS and allow the game origin through CORS. The browser cannot connect to a developer machine's `localhost` or private LAN address from a player's phone.

Before release, verify that `POST /api/v1/auth/exchange` is reachable from the deployed WebView origin and returns a JSON API response, then test launch token exchange, nickname, game start/finish, leaderboard, bird selection, and the SONO payment flow on a real device. A static build alone cannot validate the live Player API or Flutter bridge.

## Integration

The SONO app provides `window.SonoBridge.call(method, params)` with `getLaunchToken`, `payWithPoints`, `getPointBalance` and `openExternalUrl`; see [the host bridge](INTEGRATION.md#host-bridge). **Бэлэг харах** opens Fine Gold products and **Заавар үзэх** opens the supplied OneLink through this bridge. The web client does not navigate the game WebView away if the method is missing.

The web client starts a run through the Player API, uses the issued seed and game config, then submits the run result for server verification. It never grants lives or treats the client score as verified.

See [Player API integration](README_BACKEND.md), [Flutter integration](INTEGRATION.md), [production deployment](docs/PRODUCTION_DEPLOYMENT.mn.md), and [security requirements](docs/SECURITY_SPEC.md).
