# Approved vs open decisions

## 2026-11-17 updated BRD V2.1 and offline board

The user supplied `Flappy sono rule 20261113.docx` from Documents. Its internal revision is V2.1, dated 2026-11-17. The project copy is `docs/Flappy_sono_rules_v2.1_2026-11-17.docx`. It supersedes the earlier workbook and GDD product rules where they conflict. The updated board is `design-reference/ui-board-2026-11-17.png`.

Current product rules are daily free 3 at 00:00 Asia/Ulaanbaatar with no carryover, free rights before earned rights, 20 SP per life, Santa at cumulative 1,500 and Goldie at cumulative 3,000 with Store activation. Early full payment +10 replaces on-time +10, overdue repayment +5, extension +3, eligible loan closure after at least seven days +15, overdue closure +5. Full scheduled amounts and per-loan/per-installment deduplication apply, with no daily repayment-right cap. Earned rights last until tournament end.

One cleared pair gives one point. Daily totals persist. Leaderboards show Top 10 and the own row when outside Top 10, refresh once a minute and offer today, previous day and overall standings. Daily rewards have one winner, overall rewards have five. Actual prize values are pending.

The speed schedule increments by 0.1 at cumulative 10, 25, 45, 70, 100… pairs. The offline preview calculates the continuing series. Base gravity, jump, gap and speed remain demo tuning. API games continue to use the backend-issued config, which needs reconciliation with V2.1. Day/night is chosen on entry using Ulaanbaatar time, 07:00–18:00 day and 18:00–07:00 night.

The user requested offline static screens while the LAN backend is unreachable. The 2026-11-18 live-backend follow-up restores development API mode by default. `?mode=mock` explicitly selects isolated preview data. The 34 screen routes and sample thumbnails are at `?screens=1`. Finance eligibility, production rights, rewards and score verification remain server-owned.

Remaining gaps for this board are listed below.

- The latest Fine Gold section now supplies the FLAPPY SONO wordmark, sponsor mark, Store/life-ledger footer icons, rank characters and gold-prize artwork. They are extracted individually with source-node mappings in `design-reference/figma-fine-gold/runtime-manifest.json`.
- `ASSET_PENDING` final night gameplay and twelve previously requested theme/time variants. Night uses a tinted day backdrop as a review placeholder. Santa and Goldie still need their own wing poses.
- `API_PENDING` daily/previous standings, personal score history, SP balance and prize metadata. `INTEGRATION_PENDING` `/api/v1/lives/history` is now in the latest Swagger and needs frontend mapping/pagination. Their offline views use isolated sample fixtures. API mode shows a pending message for missing list endpoints. Server-owned bird ownership and selection are integrated through `/birds` and `/me/bird`.
- `HOST_PENDING` native confirmation and the host winner popup. The static SONO sheet has a non-interactive keypad plus an explicit mock approval button. The host entry and winner popup are visual demos.
- `VERIFY_PENDING` physical iOS/Android Flutter WebViews, native callbacks, production score verification, financial reward delivery and load testing.


## 2026-11-17 Player API integration

The user approved following the supplied backend collection and Swagger contract. API-connected games therefore consume the server's speed schedule, physics, gap and spawn interval. The UI mock follows the continuing V2.1 speed schedule. The server owns daily free plays, extra lives, pricing, tournament membership and ranking. Player API FINISHED is displayed as a recorded server result. SEC-02 replay/trusted-score verification and financial reward eligibility remain unresolved. Native payment confirmation and core callbacks require the vendor's host integration. See `README_BACKEND.md` for the current contract and development configuration.

## 2026-11-18 live Swagger follow-up

The reachable Player API now exposes 14 endpoint paths. New `GET /api/v1/birds` and `PUT /api/v1/me/bird` supply catalog ownership, cumulative unlock thresholds and persistent selection. `MeResponse.selectedBird` restores the chosen skin; `FinishResponse.newlyUnlocked` is supplemented by a catalog refresh after finish. Store activates an unlocked bird only after the server confirms the request. Missing or unknown art is marked, and failed catalog loads offer retry.

`CONFIG_GAP`: the live tournament `local-dev` supplies Santa 50 / Goldie 150, whereas BRD V2.1 requires 1,500 / 3,000. API mode follows the server and mock follows V2.1. Align the production backend configuration; the client must not override server ownership. The current game config also caps speed at 2 with a finite threshold list, while V2.1 preview continues the series.

Browser QA verified API authentication, nickname persistence, default-bird activation/persistence, locked-skin rejection, one-right-per-run consumption, 0- and 2-pipe FINISHED responses, total/leaderboard updates and a 20-SP pending life order restored after reload. Unlocked Santa/Goldie selection and tournament relocking have injected-transport regression coverage. Real native approval, core payment callbacks and trusted-score/financial eligibility remain pending.

## Earlier approvals, superseded where V2.1 differs
- Tap to start; one tap = one flap; collision -> immediate Game Over; app background -> Game Over.
- Strict Online; network threshold timeout -> Game Over; save only server-verified score.
- Difficulty: scroll speed constant; pipe vertical gap and horizontal spacing shrink with progress.
- Three visual themes, each with morning/day/evening/night variants: 12 designer-supplied visual states. The number of pipes between time-of-day changes is undecided and must follow difficulty playtesting. The current 25-pipe demo cycle is not approved for release.
- Three or four milestone skins are planned. Unlocks use the highest cleared pipe count in one server-verified run. Final skin count and thresholds are undecided; the local 50/100/200 values are placeholders.
- The SONO app vendor will host the miniapp frontend. The game will also use the owner's separate game-service server and SONO core services; exact contracts are pending vendor discussion.
- Leaderboard: global Top 10 plus player's own rank; SONO account identity.
- SFX, wing animation and vibration; screenshot/recording allowed.
- Integrity failures may play, reward held for review. Suspicious bot input flagged for review.
- One active run/account; one-time session, expiry, nonce, sequence; reward idempotent backend auto issue.
- Production WebView debugging disabled; HTTPS, CSP, verified release manifest.
- SEC-02 server score architecture is Backend Team decision, NOT approved here.

## Historical product questions before V2.1
1. UI shows **meters** (78m, 120m, 2101m) while approved leaderboard/unlock uses **pipe pairs**. Decide what is primary and whether dual scores display.
2. UI has `амь авах` and attempt purchase packs (100 SP->1, 400->5, 900->12), but gameplay disallows mid-run revive. Are these *new run credits*? Any starting free attempts/day?
3. Skin unlock-by-best vs store-priced bird skins (350/450 SP): Are shop skins purely cosmetic add-ons, or the same four rank skins? Can users purchase locked rank skins?
4. SONO points spending to buy attempts and SONO points / loan entitlement reward: economy, abuse limits, refund/reconciliation and financial approval unresolved.
5. Gifts vs Stats: distinct screens/functions or same leaderboard component?
6. Phone and player name display: confirm data minimization, masking, consent, and whether editing allowed.
7. Is 2-second crossfade and starting logical resolution 360x640 acceptable? Both unapproved proposals.
8. What happens if app foregrounds after legitimate phone call: game over already approved, but must show verified score and explanatory reason.
9. Need the designer's 12 time-of-day/theme variants and final three or four skin sets; currently only one bird set and one sky/bush/foreground set are available.
10. Font, logo, animated backdrop variants, play attempt counter icon and detailed time-of-day lighting are not separate assets.
11. Decide the time-of-day cadence, theme selection/rotation, final skin count and one-run verified-best thresholds after difficulty playtesting.

## Security blocking questions (Backend / Compliance)
- SEC-02 trusted score verification design, authoritative validation timeline, suspicious score policy/appeal.
- Game attempt decrement: when is credit reserved/committed/refunded after network fault?
- Reward credit ledger, idempotency, reconciliation, maximum loan entitlement and regulatory treatment.
- Play Integrity/App Attest rollout policy and mobile device exceptions.
- Agree with the vendor on Flutter-to-game identity handoff, trusted score verification, core SP balance/debit/credit APIs, and deployment/release responsibilities. These contracts are not approved yet.

## 2026-11-16 BRD and rights workbook reconciliation

See [the source-by-source audit](RULE_AND_RIGHTS_AUDIT_2026-11-16.mn.md). The newer business-rule document and rights workbook disagree on extension rights (**3 vs 5**), daily reset time (**00:00 vs 00:01**), and the exact 7-day loan-close boundary. The BRD proposes speed increases at 10/15/20/25… cleared obstacles, conflicting with the approved constant-speed, shrinking-gap/spacing model above. Product and backend owners must settle a versioned rule set before production entitlement or gameplay tuning changes.

The workbook's 19.16 million “total rights” combines earned rights, expected free-right use, and a maximum all-users Sono-point exchange scenario. It is not an issued-rights balance, actual games played, or capacity forecast. Keep these metrics separate in service contracts and dashboards.


## 2026-11-18 UI API inventory follow-up

Live Swagger returned HTTP 200 with 15 paths. New `GET /api/v1/lives/history` supplies earned/spent/expired entries, daily free allocations, tournament context and cursor pagination. This is a frontend integration task rather than a missing backend endpoint. The new snapshot is `docs/api/player-openapi-2026-11-18-ui-audit.json`; the earlier 14-path snapshot is preserved. The complete view-to-data list and proposed missing contracts are in `docs/UI_API_REQUIREMENTS.mn.md`. Order failure reasons, winner notification/date/contact copy and optional masked-phone display also need an agreed contract. No frontend or financial behavior was changed in this inventory pass.
