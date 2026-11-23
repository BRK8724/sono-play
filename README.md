# Flappy SONO Mini App

Standalone Flutter WebView game client. In production, the Player API remains authoritative for account, entitlement, catalog, and score operations. A separate local preview fixture is available while the API server is unavailable.

## Local development

1. Install Node.js 22.18 or later.
2. Copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL` to the Player API origin. Leave it blank to use same-origin routing.
3. Run `npm install`, then `npm run dev -- --port 5177`.
4. Open the app inside the SONO host bridge. A regular browser without the host launch token cannot authenticate.

For a local UI and flow preview without the API server, run `VITE_LOCAL_MOCK_API=1 npm run dev -- --host 0.0.0.0 --port 4177` and open `http://<your-computer-LAN-IP>:4177/?mock=1`. The mock API and its sample leaderboard, life history, points, and catalog live only in `src/services/LocalMockApi.ts`; normal production builds omit them. The page labels mock mode visibly.

`npm run build` runs TypeScript validation and creates the production web bundle. `npm run preview` serves that bundle locally.

## Integration

The SONO app provides `window.SonoBridge.call(method, params)` with `getLaunchToken`, `payWithPoints`, `getPointBalance` and `openExternalUrl`; see [the host bridge](INTEGRATION.md#host-bridge). The web client does not navigate the game WebView away if a method is missing. In an ordinary browser preview, the gift and guide buttons open a new tab.

The web client starts a run through the Player API, uses the issued seed and game config, then submits the run result for server verification. It never grants lives or treats the client score as verified.

See [README_BACKEND.md](README_BACKEND.md), [vendor integration notes](docs/VENDOR_INTEGRATION_AGENDA.mn.md), [security requirements](docs/SECURITY_SPEC.md), and [required files and connections](docs/REQUIRED_FILES_AND_CONNECTIONS.mn.md).
