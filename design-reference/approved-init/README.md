# Flappy SONO — Codex Bootstrap

Use `CODEX_START_HERE.md` before changing code. This package is a **local, non-reward prototype**, not a production financial game.

```bash
npm install
npm run dev
npm run build
```

UI baseline: 13 pages of `docs/ui/source-design.pdf`. Approved decisions: `docs/SECURITY_SPEC.md` and `docs/DECISIONS_AND_GAPS.md`. Original standalone PNGs are in `public/assets/legacy`.

No SONO backend integration, app credentials, financial reward, purchases or PIN is implemented. No test harness currently included. `src/main.ts` includes only a minimal Phaser gameplay sketch; artwork/scaling still need QA and design integration.
