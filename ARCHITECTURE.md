# Sono Play integration contract

The current vendor discussion checklist is [docs/VENDOR_INTEGRATION_AGENDA.mn.md](docs/VENDOR_INTEGRATION_AGENDA.mn.md). The earlier [production architecture proposal](PRODUCTION_ARCHITECTURE.mn.md) optimizes for minimal core-server traffic while keeping the core SP ledger authoritative. Its deployment and API details are unapproved; the vendor will host the frontend, while the owner's game server remains separate.

## Trust boundary

The game client and its `localStorage` cannot credit or debit real SP. The Play server validates runs, owns game inventory and pending bonuses, and batches reward settlements. The core server owns the available SP balance, immutable ledger, SP policy, and any effect on loan privileges. A pending bonus is not available SP.

## Minimal core interactions

1. On game launch, Flutter makes one authenticated core request for a short-lived, signed Play launch assertion containing an opaque subject ID, SP balance snapshot and ledger version, eligibility and origin/version. The Play server verifies it locally using cached public keys and enforces one-time `jti` use. It does not exchange it with core on every launch.
2. Runs, scores, game coins, and pending bonuses remain on the Play server. A worker batches eligible SP rewards for the core ledger. Core applies its own policy, caps, idempotency and account checks to each settlement.
3. Real SP purchases require a core debit at commit time. Most game cosmetics should use Play-only game coins if the goal is to keep core load low.
4. A balance snapshot or Play cache is for display only. The core is the source of truth for available SP and loan-related actions. If core already publishes balance-change and account-revocation events, Play consumes them to refresh its read model.

## Deployment and performance

Host the versioned Vite build on the Play origin/CDN and route `/api` to the Play API. For a versioned subpath, build with `npm run build -- --base=/sono-play/v1/`. Keep the gameplay frame loop independent of network calls; load menu assets first, defer store assets, pool pipes and pause on backgrounding. Profile cold start, frame time, WebView memory, and asset transfer on physical devices.

The current standalone game displays only a local, unverified pipe score. The Pocketwise repository in `Documents/Codex/2026-11-06/referenced-chatgpt-conversation-this-is-an/outputs` is a demo, not the production core app. Real SP integration is pending the core API and approved reward policy.
