# Codex: initialize Flappy SONO safely

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

## First Codex task
1. Inspect `docs/ui/SCREEN_MAP.md`, screenshots 10, 11, 12 and original assets.
2. Polish Home -> Ready -> Playing -> GameOver with responsive layout; preserve visual style of screenshot, DO NOT add real rewards.
3. Write tests for score increment once per pair, 25-pipe theme cycle, unlock thresholds, gameover on background, and blocking score submit in mock mode.
4. Mark missing art as `ASSET_PENDING` and do not pretend 4 bird skins or 4 themes exist.
5. Produce PR checklist and update `docs/IMPLEMENTATION_STATUS.md`.

## Release gate
Do not enable real rewards, leaderboard writes, purchases, points, or loan credit changes until trusted backend API, auth bridge, finance controls and pen test are approved.
