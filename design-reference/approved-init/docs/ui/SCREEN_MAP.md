# Visual UI screen map (source: export-2.pdf)

| Page | Screen | Reference | Observed design |
|---|---|---|---|
| 1 | Gifts leaderboard overlay | `ui-page-01.png` | Top-10 leaderboard with own rank; bird + coin icons; numeric score shown in m; countdown-like text. |
| 2 | Stats leaderboard overlay | `ui-page-02.png` | Nearly identical top-10 leaderboard; likely reused component; confirm difference from Gifts. |
| 3 | Store modal | `ui-page-03.png` | 2-column store, SONO bird skins and background products; BUY labels 350/450 SP. |
| 4 | Settings modal | `ui-page-04.png` | Player name, phone, audio and vibration icon buttons. |
| 5 | Insufficient points dialog | `ui-page-05.png` | Cannot buy lives/attempts due to insufficient SONO points. |
| 6 | Purchase success dialog | `ui-page-06.png` | Confirms purchase of 12 play attempts. |
| 7 | SONO PIN bottom sheet | `ui-page-07.png` | Four-digit PIN input shown in native-looking sheet; MUST be handled by trusted host, not game JS. |
| 8 | Buy attempts modal | `ui-page-08.png` | SONO points -> attempts: 100/1, 400/5, 900/12; BUY. |
| 9 | Game Over + buy attempts | `ui-page-09.png` | Game Over SCORE 78m, zero badge, purchase attempts CTA; conflicts with no-revive wording until defined. |
| 10 | Playing HUD | `ui-page-10.png` | SCORE and BEST in m; life/attempt counter below gameplay; decorative pipes and ground. |
| 11 | Tap to Play state | `ui-page-11.png` | Ready screen; score, best, center tap-to-play, attempt counter. |
| 12 | Home screen | `ui-page-12.png` | SONO PLAY logo; PLAY, STORE, STATS; gifts and settings bottom icons. |
| 13 | SONO host entry | `ui-page-13.png` | Main SONO app entry card and bottom navigation; host-owned, not game-owned. |


## Suggested route/state map (implementation proposal)
`SONO host entry (13)` -> `Home (12)` -> `Ready (11)` -> `Playing (10)` -> `Game Over (9)` -> `Home/Retry`.
Home -> `Store (3)`, `Stats/Gifts (2/1)`, `Settings (4)`.
Game Over -> `Attempt packages (8)` -> `native SONO PIN (7)` -> either `Success (6)` or `Insufficient points (5)`, subject to approved transaction API and purchase policy.

## UI cues and implementation notes
- Portrait composition; desktop should letterbox rather than stretch sprites.
- Distinct arcade/block lettering; exact font file NOT supplied. Use licensed fallback and flag designer handoff.
- Purple pill modal tabs, rounded white cards, green primary CTA; do not infer exact color tokens from screenshots.
- Scene background is atmospheric night/sunset for menu; gameplay blue sky/day example. Morning/evening/night assets are incomplete.
- HUD screenshot labels `SCORE 78m`/`BEST 120m` conflict with official pipe-based leaderboard. Require product clarification, do not silently change the scoring basis.
- Gifts and Stats mockups (1,2) appear visually nearly identical; confirm separate features versus one leaderboard.
- Page 7 PIN is reference-only; implement purchase authentication in trusted host/native app, never a Phaser HTML keypad.
- Page 9 `амь авах` and pages 5–8 describe buying *attempts/lives*. User approved **no revive**, so purchases must NOT resurrect a live game unless new approval.
- Page 13 is host app navigation and should not be recreated inside mini game.
