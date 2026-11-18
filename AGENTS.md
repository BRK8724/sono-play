# Flappy SONO — Codex operating instructions

Start with `CODEX_START_HERE.md`. Review `docs/ui/SCREEN_MAP.md`, `docs/SECURITY_SPEC.md` and `docs/DECISIONS_AND_GAPS.md` before editing.

## Ground truth and precedence

1. Current product source is `docs/Flappy_sono_rules_v2.1_2026-11-17.docx`, supplied by the user on 2026-11-17. It supersedes earlier product rules for cumulative skins, speed progression, daily rights and day/night backgrounds. Security decisions remain in force.
2. Current UI source is the user-selected Figma `Тоглоом fine gold`, node `168:9379`, extracted in `design-reference/figma-fine-gold/`. The screen board `design-reference/ui-board-2026-11-17.png` remains a visual overview. The LAN Player API is now available and development defaults to API mode. Isolated offline review remains at `?mode=mock` and `?screens=1`. Read `docs/DECISIONS_AND_GAPS.md` for the remaining assets and API gaps.
3. User-approved product/security decisions in docs.
4. Provided UI PDF for visual reference only (13 pages, page numbers explicit).
5. Provided PNG artwork; do not invent missing theme/skin assets.
6. Proposals/config defaults are NOT approved balancing parameters.

## Hard financial-security boundaries

- NEVER grant, persist, simulate, or call a real SONO reward/loan entitlement API from frontend code.
- NEVER trust frontend score as verified. Keep `displayScore` distinct from `verifiedScore`.
- A mock/local run is not reward eligible. Mock-only sample balances and approval buttons are authorized for UI review. Keep them isolated in `MockMiniappService`. The preview PIN sheet is a read-only visual with one explicit simulation button. Real PIN entry belongs to the Flutter host. The user approved the Player API integration separately, see `README_BACKEND.md`.
- Do not expose SONO auth/financial session secrets to game JavaScript. No PIN collection in WebView.
- Strict online, background -> Game Over; server final score and reward outcomes are authoritative.
- SEC-02 score-verification architecture is deliberately UNDECIDED and owned by backend.
- Never change business semantics by assuming meters equal cleared pipe count.

## Implementation boundaries

- One account -> one active server game session (backend-enforced).
- Skins use cumulative tournament points. BRD V2.1 and mock use Pilot 0, Santa 1,500 and Goldie 3,000. API Store consumes `GET /api/v1/birds` catalog metadata and awaits `PUT /api/v1/me/bird` selection. The current local-dev server uses 0/50/150, which is a recorded backend configuration discrepancy. API behavior follows the server's `unlockScore`, `unlocked` and selected state. Local art IDs map `pilot=sono`, `santa=santa_sono`, `gold=goldy_sono`. A new tournament can relock birds and use the server default until the saved choice unlocks.
- Progressive speed increases by 0.1 at cumulative thresholds 10, 25, 45, 70, 100… cleared pairs. API runs consume server-issued tuning. The offline adapter previews the V2.1 schedule. Base physics and gap are preview tuning values.
- Client scroll/spawn speed now approaches each server-issued threshold over 0.4 seconds. This is user-requested presentation/gameplay behavior; backend SEC-02 replay and reward verification must agree on the transition before production eligibility. Never infer that slower-than-config client motion is automatically trusted.
- Select day/night on entry using Asia/Ulaanbaatar time, day 07:00–18:00 and night 18:00–07:00. The earlier three-theme/twelve-state art plan still has missing assets. The current night tint is a marked placeholder until final artwork arrives.
- Focus on responsive views, keyboard/pointer, error/loading, accessibility, deterministic game state.
- Make small, testable changes and update `docs/IMPLEMENTATION_STATUS.md` with evidence.

- Runtime images/fonts/thumbnails must use `assetUrl()` and the registry in `build/runtime-assets.mjs`. Production emits content-hashed paths and `release-manifest.json`; unregistered assets fail fast. Keep the build module in vendor source handoffs.
- Static Phaser rendering is managed by `RenderActivity` in `src/renderPerformance.ts`. State/canvas changes must request a render or enable continuous animation. Preserve effect completion, visibility termination and geometry-before-physics ordering when editing.

- Keep `GAME_FRAME_TIMING.smoothStep=false`: the fixed-step simulation must consume actual elapsed time. Phaser's default wake/focus smoothing causes lower-frame-rate startup slowdowns. Preserve the wake reset and long-frame cap; do not balance gameplay by display refresh rate.
- The Phaser canvas uses Scale.NONE, backing pixels capped at DPR 1.5 for phone frame-time headroom, reciprocal ScaleManager zoom, and top-left camera zoom. CSS/world geometry stays in viewport pixels. Keep explicit canvas CSS sizing when DPR returns to 1 and recheck camera alignment, input and safe areas on resize.
