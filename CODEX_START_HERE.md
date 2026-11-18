# Codex: initialize Flappy SONO safely

## Current task source, 2026-11-18

Read the current precedence in `AGENTS.md`. The latest supplied BRD is `docs/Flappy_sono_rules_v2.1_2026-11-17.docx`. The current Figma source is `Тоглоом fine gold`, node `168:9379`, extracted in `design-reference/figma-fine-gold/`. The screen board `design-reference/ui-board-2026-11-17.png` is an overview. Development defaults to the LAN Player API. Offline review opens at `?mode=mock` or `?screens=1`.

The latest Player API has 15 paths; the new `/api/v1/lives/history` needs frontend wiring. See `docs/UI_API_REQUIREMENTS.mn.md`. Existing integration includes `GET /api/v1/birds` and `PUT /api/v1/me/bird`. API Store uses server-issued unlock and selected state through the optional `birdCatalog` metadata. Map local `pilot/santa/gold` to backend `sono/santa_sono/goldy_sono`. Local-dev currently uses 0/50/150 unlock thresholds. BRD V2.1 and mock use 0/1,500/3,000, so backend configuration needs reconciliation. Native payment and financial reward integration remain pending. The following initialization steps document the original phase. Current evidence is at the end of `docs/IMPLEMENTATION_STATUS.md`.

## What is included

- `docs/Flappy_SONO_GDD_v1.2_UI_Appendix.docx` — earlier v1.1 GDD + UI PDF review appendix.
- `docs/ui/source-design.pdf` and `docs/ui/reference/ui-page-XX.png` — 13 original screens.
- `docs/ui/SCREEN_MAP.md` — screens, transitions, implementation notes.
- `docs/SECURITY_SPEC.md` — security decisions SEC-01..13, SEC-02 delegated to backend.
- `docs/DECISIONS_AND_GAPS.md` — design conflicts; MUST NOT silently resolve.
- `public/assets/legacy/` — provided design files, NOT production-ready sprite atlas.
- `src/` — minimal Phaser + Vite TypeScript starter with local-only gameplay demonstration.

## Run

```bash
npm install
npm run dev
npm run build
```

## Original initialization tasks

1. Inspect `docs/ui/SCREEN_MAP.md`, screenshots 10, 11, 12 and original assets.
2. Polish Home -> Ready -> Playing -> GameOver with responsive layout; preserve visual style of screenshot, DO NOT add real rewards.
3. Write tests for score increment once per pair, 25-pipe theme cycle, unlock thresholds, gameover on background, and blocking score submit in mock mode.
4. Mark missing art as `ASSET_PENDING` and do not pretend 4 bird skins or 4 themes exist.
5. Produce PR checklist and update `docs/IMPLEMENTATION_STATUS.md`.

## Release gate

The user approved following the supplied Player API contract for profiles, game records, life orders, leaderboard reads and bird selection. Native PIN/payment callbacks, trusted score verification and financial rewards remain server/host integration work. Apply the existing controls in `docs/SECURITY_SPEC.md` to production delivery.
