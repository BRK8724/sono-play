# Vendor handoff

This directory is the standalone Flappy SONO WebView mini app. It contains app source, runtime artwork, API integration, and production deployment guidance. Configure the Player API origin and serve the built `dist/` directory over HTTPS. Do not serve the development Vite server in production.

The app requires a host-provided launch token through `window.SonoBridge.getLaunchToken()`. When native payment approval is enabled, expose `window.SonoBridge.payWithPoints({ orderId })`. Core credentials and PIN handling remain inside SONO Core. The Player API remains authoritative for game sessions, rights, catalog state, orders, verification, and score persistence. The browser does not grant entitlements or verify scores.

Run `npm install` and `npm run build`. Set `VITE_API_BASE_URL` to an HTTPS API origin for cross-origin routing, or keep it blank behind same-origin reverse proxy routing. See [backend integration](README_BACKEND.md) and [deployment checklist](docs/PRODUCTION_DEPLOYMENT.mn.md).
