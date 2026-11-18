# Frontend implementation phases

1. **Home, Ready, Playing, Game Over (complete locally).** Preserve the supplied art direction. Implement tap/Space flight, fixed-step physics, one point per cleared pair, terminal background/offline outcomes, full-viewport responsive canvas, audio and explicit unverified local score. No financial actions.
2. **Visual completeness (blocked on artwork).** Integrate the designer's three themes with morning/day/evening/night variants (12 visual states) and the final three or four bird skin sets. Set transition cadence after difficulty playtesting; the local 25-pipe cycle is a placeholder. Review pages 10–12 against a designer-approved asset sheet at representative phone sizes.
3. **Backend and Flutter integration (blocked on SEC-02).** Add a Play-only auth assertion handoff and server-owned run state. Display verified best, global Top 10 and own rank from the Play server. Server validates scores and owns unlock thresholds. No browser persistence of authoritative score.
4. **Economy and remaining screens (blocked on product and finance decisions).** Define Store, Stats, Gifts, attempts and the SP economy after approval. Implement backend-only purchases/credits with finance controls. Complete screens 1–9 and 13 with host ownership clarified.
5. **Release validation.** Real iOS/Android WebView QA, accessibility, frame-time and memory profiling, network failure tests, 200k concurrent-player load test, security review, penetration test and ledger reconciliation.

## ASSET_PENDING

- Final three or four full bird skin sets and 12 theme/time-of-day visual states. The base bird body and three wing poses have now been supplied and integrated.
- Standalone font/logo variants, animated backdrop elements, play-attempt icon, finished Store/Stats/Gifts assets.
- The base bird and pipe art now use supplied `bird-body.png`, `bird-wing-1/2/3.png` and `pipes-sheet.png`. `game-background.webp`, `menu-background.webp` and `menu-logo.png` remain prototype art pending design sign-off.

## Unresolved decisions

Use [DECISIONS_AND_GAPS.md](DECISIONS_AND_GAPS.md) as the decision log. In particular: meters versus pipe count; new run credits and free attempts; rank skins versus purchasable cosmetics; points/loan reward economy; Gifts versus Stats; profile privacy; transition duration; and SEC-02 trusted score validation. Current balancing values in `src/rules.ts` are proposals only.

## PR checklist

- [x] Initial build validated before editing.
- [x] Approved docs and 13-page map reviewed; original files retained.
- [x] Four phase frontend and local safety boundaries implemented.
- [x] Unit tests cover one score per pipe, theme cadence, constant speed and unverified result.
- [ ] Designer signs off visual fidelity and supplies missing art.
- [ ] Backend approves SEC-02 and server-owned result contract.
- [ ] Production gates in Security Specification pass.
