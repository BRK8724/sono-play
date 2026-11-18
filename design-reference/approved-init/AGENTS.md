# Flappy SONO — Codex operating instructions

Start with `CODEX_START_HERE.md`. Review `docs/ui/SCREEN_MAP.md`, `docs/SECURITY_SPEC.md` and `docs/DECISIONS_AND_GAPS.md` before editing.

## Ground truth and precedence
1. User-approved product/security decisions in docs.
2. Provided UI PDF for visual reference only (13 pages, page numbers explicit).
3. Provided PNG artwork; do not invent missing theme/skin assets.
4. Proposals/config defaults are NOT approved balancing parameters.

## Hard financial-security boundaries
- NEVER grant, persist, simulate, or call a real SONO reward/loan entitlement API from frontend code.
- NEVER trust frontend score as verified. Keep `displayScore` distinct from `verifiedScore`.
- A mock/local run is NOT reward eligible; disable claim, PIN, purchases and score submissions unless the backend integration is approved.
- Do not expose SONO auth/financial session secrets to game JavaScript. No PIN collection in WebView.
- Strict online, background -> Game Over; server final score and reward outcomes are authoritative.
- SEC-02 score-verification architecture is deliberately UNDECIDED and owned by backend.
- Never change business semantics by assuming meters equal cleared pipe count.

## Implementation boundaries
- One account -> one active server game session (backend-enforced).
- One verified best pipe count unlocks 50/100/200 skins; store purchases are a separate unresolved rule.
- Progressive difficulty: constant scroll speed, reduce vertical gap and horizontal center-to-center spacing (tunable).
- Time-of-day changes every 25 pipes: morning, day, evening, night; 2s crossfade suggested not finalized.
- Focus on responsive views, keyboard/pointer, error/loading, accessibility, deterministic game state.
- Make small, testable changes and update `docs/IMPLEMENTATION_STATUS.md` with evidence.
