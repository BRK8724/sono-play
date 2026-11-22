# Flappy SONO vendor project instructions

This checkout is the clean, standalone WebView game client. The original working project is kept separately. This handoff has no mock-account, test-fixture, or screenshot-gallery runtime.

## Product and security rules

- The Player API and SONO host are authoritative for identity, game sessions, rights, payments, catalog/unlocks, score verification, and rewards.
- Never grant an entitlement, simulate a financial transaction, or call a real reward API from frontend code.
- Keep the displayed score separate from the server-verified result. Never trust client-reported score for financial eligibility.
- Never collect or expose PINs, core credentials, signing secrets, or long-lived tokens in WebView JavaScript or `VITE_*` variables.
- Game launch and finish follow the server-issued session, seed, and physics configuration. Do not add API calls per tap or frame.
- Core and Player API responsibilities, open security decisions, and deployment requirements are documented in `docs/SECURITY_SPEC.md`, `docs/DECISIONS_AND_GAPS.md`, and `README_BACKEND.md`.

## Code and release rules

- Keep the mini app portable for vendor Flutter WebView hosting. Preserve the `SonoBridge` contract in `src/services/HostBridge.ts`.
- Follow the API contract in `docs/api/player-openapi-2026-11-18-ui-audit.json`.
- Runtime images and fonts must be registered in `build/runtime-assets.mjs` and loaded with `assetUrl()` where applicable. The production build hashes assets and emits `release-manifest.json`.
- Preserve deterministic server-seeded gameplay, fixed-step simulation, pooled obstacles, adaptive render limits, background termination, responsive geometry, and reduced rendering while static.
- Before handoff run `npm run format:check` and `npm run build`. The vendor package intentionally has no mock fixtures or test suite.
