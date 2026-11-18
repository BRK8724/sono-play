# Flappy SONO difficulty audit — 2026-11-16

This is a mechanics audit, **not a measured human score distribution**. It must not be used to activate SP rewards. One displayed point means one cleared pipe pair; `verifiedScore` is still unavailable.

## Current build, representative 390 × 844 viewport

Assumptions: native safe insets top 54/bottom 34 px; `layoutFor`, `responsiveGap`, `difficultyFor` and the actual bird/pipe collision widths in `src/main.ts`. Values are approximate because browser viewport and safe insets vary.

| Cleared pairs | Vertical opening | Pipe center spacing | Seconds between pipes |
| ---: | ---: | ---: | ---: |
| 0 | 167 px | 255 px | 1.76 s |
| 25 | 162 px | 250 px | 1.72 s |
| 50 | 158 px | 245 px | 1.69 s |
| 100 | 149 px | 235 px | 1.62 s |
| 200 | 131 px | 215 px | 1.48 s |
| 225+ | 126 px | 210 px | 1.45 s |

The original generator chose each center independently over the full allowed height. At score 200, this produced a lower bound of roughly 3.2% **physically impossible upward transitions per adjacent pair** even with ideal input. On 2026-11-16 the generator was changed to keep adjacent collision-safe openings vertically overlapping with an 8-unit margin. This removes that particular forced-jump geometry; it does **not** prove every full flight trajectory easy or reachable. Human playtesting and a server-compatible deterministic generator are still needed.

Before the responsive fix, a 320 × 568 viewport had about 19% less vertical clearance relative to bird size than 390 × 844. The current build scales the opening with the bird: at score 0, clearance is about 108 px on 320 × 568 and 133 px on 390 × 844, both about **133 logical units** after normalizing by bird scale. Device fairness must still be checked on real hardware and in later theme art.

Approximate uninterrupted run times for score 1 / 5 / 10 / 25 / 50 / 100 / 200 are 2.7 / 9.7 / 18.5 / 44.9 / 88 / 172 / 329 seconds. These are timing calculations, not predicted human performance.

## Measure people before setting point rules

1. Freeze one build, physics configuration and random seed logging. Recruit at least 30–50 ordinary mobile users for 20 attempts each, plus a practiced group. Include compact and regular iPhones and Android devices. These are pilot planning sizes, not a statistical guarantee.
2. Record only anonymous `buildVersion`, `deviceViewport`, `attemptIndex`, `randomSeed`, `displayScore`, `runDuration` and terminal reason. Keep these QA records separate from any verified score or SP ledger; never use client logs to grant rewards.
3. Report per-run score median, P75/P90/P99, the best of 20 attempts per player, reach rates for 1/5/10/25/50/100/200 pairs, and failure rate conditional on reaching each score band. Split by device size and first versus later attempts to expose learning and fairness issues.
4. If playtesting finds new forced transitions or device effects, fix them and repeat the pilot. Only after backend score verification and finance approval, choose rewards against verified-score percentiles and a maximum liability budget. Do not infer financial eligibility from this demo.

Until there is human data, labels such as “average player passes 5 pipes” or “expert passes 50” are guesses, not findings. The present 50/100/200 thresholds are **local demo placeholders**, not approved release rules or evidence that those scores are realistically attainable. Final skins will unlock from a server-verified best single run, at thresholds decided after testing.

As a **draft design target only**, an approachable version could aim for a new player's first-five-run median of 0–3, a typical player's best of 20 attempts of 5–20, and a practiced player's best of 20 attempts of 25–50. These are intended test targets, not predictions or reward thresholds. The pilot should confirm or reject them.
