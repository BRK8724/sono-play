# Approved vs open decisions

## Approved
- Tap to start; one tap = one flap; collision -> immediate Game Over; app background -> Game Over.
- Strict Online; network threshold timeout -> Game Over; save only server-verified score.
- Difficulty: scroll speed constant; pipe vertical gap and horizontal spacing shrink with progress.
- Four day phases every 25 pipe pairs, smooth background/bush/ground/lighting transition.
- Four bird skins; unlock by BEST single-run cleared pipe count: 0 / 50 / 100 / 200.
- Leaderboard: global Top 10 plus player's own rank; SONO account identity.
- SFX, wing animation and vibration; screenshot/recording allowed.
- Integrity failures may play, reward held for review. Suspicious bot input flagged for review.
- One active run/account; one-time session, expiry, nonce, sequence; reward idempotent backend auto issue.
- Production WebView debugging disabled; HTTPS, CSP, verified release manifest.
- SEC-02 server score architecture is Backend Team decision, NOT approved here.

## BLOCKED questions needing product/business sign-off
1. UI shows **meters** (78m, 120m, 2101m) while approved leaderboard/unlock uses **pipe pairs**. Decide what is primary and whether dual scores display.
2. UI has `амь авах` and attempt purchase packs (100 SP->1, 400->5, 900->12), but gameplay disallows mid-run revive. Are these *new run credits*? Any starting free attempts/day?
3. Skin unlock-by-best vs store-priced bird skins (350/450 SP): Are shop skins purely cosmetic add-ons, or the same four rank skins? Can users purchase locked rank skins?
4. SONO points spending to buy attempts and SONO points / loan entitlement reward: economy, abuse limits, refund/reconciliation and financial approval unresolved.
5. Gifts vs Stats: distinct screens/functions or same leaderboard component?
6. Phone and player name display: confirm data minimization, masking, consent, and whether editing allowed.
7. Is 2-second crossfade and starting logical resolution 360x640 acceptable? Both unapproved proposals.
8. What happens if app foregrounds after legitimate phone call: game over already approved, but must show verified score and explanatory reason.
9. Need actual 4 skin sprite sets and 4 theme layers; currently only one bird set and one sky/bush/foreground set provided.
10. Font, logo, animated backdrop variants, play attempt counter icon and detailed 4 theme lighting are not separate assets.

## Security blocking questions (Backend / Compliance)
- SEC-02 trusted score verification design, authoritative validation timeline, suspicious score policy/appeal.
- Game attempt decrement: when is credit reserved/committed/refunded after network fault?
- Reward credit ledger, idempotency, reconciliation, maximum loan entitlement and regulatory treatment.
- Play Integrity/App Attest rollout policy and mobile device exceptions.
