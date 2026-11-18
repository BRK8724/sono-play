# Implementation status — 2026-11-13

## Complete: phase 1 local frontend

- Existing web project built successfully before changes. Approved starter ZIP extracted into `design-reference/approved-init/`; its `AGENTS.md`, `CODEX_START_HERE.md`, GDD, Security Specification, 13-page UI source/reference/map and decision log are present in this project.
- Home, Ready, Playing and Game Over run in Phaser/Vite. Ready includes a static pipe preview. Tap/Space flight, fixed 120 Hz simulation, pooled pipe pairs, one display point per cleared pair, constant scroll speed with proposed shrinking gap/spacing, 25-pair theme cadence, moving backdrop, sound and crash effect are implemented. Provided body and three wing overlays animate through up/level/down on flap. Pipe shafts tile while the supplied snow caps keep fixed proportions.
- Active run ends on collision, background/pagehide or offline event. There is no pause/resume. The score is explicitly local and unverified; verified best remains blank. Store, Stats and Gifts are disabled. No reward, purchase, PIN, core API or score submit is active.
- The Phaser canvas uses `RESIZE` and fills the actual viewport. Home/HUD/Ready/Game Over are laid out against the viewport and native safe-area insets. Scene geometry recomputes on resize; art uses proportional cover cropping. No fixed 390×844 inner shell remains.
- Prior mock-wallet source is archived at `design-reference/pre-approved-demo-source.zip`; it is not in active `src/`.

## Evidence

- `npm run build`: passed before and after phase 1.
- `node --test tests/rules.test.mjs tests/layout.test.mjs`: 10/10 passed (score-once, theme cadence, difficulty, local result, verified-best skin thresholds and five viewport geometries).
- Chromium flow checked: Home → Ready → Playing → Game Over at a 500×844 browser viewport. Background termination happens once, shows an unverified result and makes no `/api/` request. Home and Game Over screenshots inspected; physical phone/WebView review remains open.
- The Pocketwise `miniapps/pet` copy built successfully after synchronization.
- 2026-11-13 iPhone 18 Pro simulator regression: `navigator.onLine` was false while the game origin was reachable. Phase 1 now probes its own origin before a run and on connectivity events. Flutter passes native safe-area insets to the WebView; the menu backdrop fills the whole phone while interactive content stays within the safe area. Pocketwise API moved to local port 3001 because port 3000 was occupied. The Flutter WebView integration test opens Home, checks safe bounds, and reaches Ready; passed on iOS simulator. Final Home screenshot was visually inspected on the simulator.
- Follow-up responsive fix: fixed 390×844 scaling created a smaller inner rectangle in Ready/Playing. Replaced it with Phaser `RESIZE`, viewport-relative scene geometry and full-bleed DOM layout. Chromium verified canvas = viewport at 320×568, 402×874 and 844×390; Home and Ready screenshots visually checked. iOS simulator WebView test verifies full canvas, footer safe area and Home → Ready. Pure geometry tests cover five viewport sizes. The supplied image dimensions were not the root cause.
- Art correction: the prior single pipe image was vertically scaled, distorting its cap and stripe pattern. The provided `pipes-sheet.png` is now used as fixed-size cap frames plus a tiled shaft. `bird-body.png` and `bird-wing-1/2/3.png` are aligned transparent overlays. Browser check observed up → level → down after flap.
- User follow-up: removed the artificial nose propeller. Moved the Ready pipe pair to the right of the notch, shortened the large vertical opening proportionally on compact screens so the lower pipe has a substantial body, and moved the Ready prompt above the bird. The gameplay gap still decreases with score; its responsive scale factor does not change that rule.
- 2026-11-16 host integration: the `miniapp asaa` launcher now serves this standalone checkout directly on port 5176, which Flutter Play → Sono's World opens in its WebView. `npm run build` passed; the launcher started this checkout and Flutter on the iPhone simulator, and the port 5176 process working directory was verified as this project. This remains a local non-reward demo.
- 2026-11-16 ground alignment: the lower pipe now extends to the ground stripe in the cover-cropped backdrop on portrait screens, with a safe viewport bound for wider screens. Browser Ready screenshot visually shows the pipe rooted at the stripe; geometry tests (10/10) and both standalone and Pocketwise copy builds passed.
- 2026-11-16 frontend handoff preparation: standalone package has pinned npm dependencies, Prettier configuration and `npm run check` (format, tests, strict TypeScript, Vite build). WebView storage denial no longer crashes audio setup; audio suspends on background. An isolated source-and-runtime-assets handoff was built with `npm ci`, passed 11 tests and compiled from a clean folder; `/sono-play/` subpath assets were verified. Backend score/finance contracts and final art remain release blockers.
- 2026-11-16 gameplay/UX follow-up: adjacent pipe openings now retain an overlapping safe band; compact and regular phones have equal opening size relative to bird scale. The Ready prompt tracks the pipe gap center instead of overlapping the upper pipe, and the bird sits below it. `npm run check` passed 13 tests and build; browser screenshots reviewed at 320×568 and 390×844. The new 12-state designer asset contract is in `DESIGN_ASSET_CONTRACT.mn.md`. Numeric balance values remain proposals awaiting playtesting.
- 2026-11-16 grounding follow-up: gameplay now owns one `groundY`; the legacy background is split into sky and ground layers at its documented art line. The lower pipe shaft continues 8 logical pixels under the ground layer, which covers the join. Browser Ready screenshots at 390×844 and 1024×768 show the lower pipe touching the ground on both viewports. `npm run check` passed 13 tests and build. The designer contract now specifies layer ratios, pixel exports, and iPad/Fold layout policy; that wider-device corridor and hinge treatment still require implementation and physical device review.
- 2026-11-16 BRD/UI follow-up: Home now opens How to Play, a read-only Stats empty state, and Settings with separate music/effects/vibration controls. HUD/Game Over label the local score as cleared pipes, leave verified best/rank unavailable, and state that demo replay uses no real rights. The planned-rights text is explicitly inactive; no entitlement, point exchange, PIN, score submission, or leaderboard write was added. `npm run check` passed 13 tests and build; Chromium visually checked Home, Settings, Rules, Stats and Game Over at 320×568 and Home at 390×844. The BRD/workbook conflicts are logged in `RULE_AND_RIGHTS_AUDIT_2026-11-16.mn.md` and `DECISIONS_AND_GAPS.md`.

## Incomplete / release blocked

- `ASSET_PENDING`: see [phase plan](PHASE_PLAN.md). Existing art is a prototype subset and no false four-skin/four-theme claim is made.
- Server-owned run/score verification (SEC-02), server heartbeat/timeout for strict-online enforcement, Flutter auth bridge, verified best and leaderboard, remaining screens, economy, financial operations and load/security testing are outstanding. `navigator.onLine` is only a local connectivity hint.
- Open visual/product choices are listed in [DECISIONS_AND_GAPS.md](DECISIONS_AND_GAPS.md). Proposed tuning values are not approved.

**Deployment classification:** local non-reward demo only. Do not publish as a production SONO game.

## 2026-11-17 final Figma frontend with mock flows

Implemented the final Figma direction from `design-reference/figma-final/source.fig` and its extracted source images. Home now has Play, Store, Rules, Stats, Gifts and Settings. Store supports browsing, mock purchase, owned/selected states and applies selected bird/background to the next flight. Settings controls music, effects and vibration. Stats shows a sample Top 10 and a dynamically calculated own rank. Gifts uses the supplied rank and voucher artwork. Ready/Playing show remaining mock rights. Game Over switches between retry and buying new-run rights when the balance reaches zero.

The attempt flow supports quantity 1–50 at the demo price of 20 SP each, mock host approval/cancellation, success, insufficient points and recoverable purchase error. Three initial rights and 5,000 SP are sample values in `src/mock/fixtures.ts`. Demo mutation state is in `MockMiniappService`; the view consumes the `MiniappService` interface. Duplicate purchase order IDs and repeated run termination are handled once. One active demo run consumes one right. Pending demo scores leave totals unchanged.

The top-right ТУРШИЛТ menu provides reset, empty rights, zero SP, next purchase error, next pending result and a SONO host-entry preview. Host preview uses mock cards. The confirmation sheet has demo approve/cancel buttons, with the native PIN entry still assigned to Flutter/core. The Mogul Square font file is pending, so Tektur/Nunito remain the rendered fonts. Santa/Gold currently have static artwork with body motion, while Pilot retains the three-pose wing animation. Dedicated skin pose layers and all twelve final theme/time variants remain pending.

The playable canvas uses a centered corridor up to 480 CSS pixels on wider viewports. Its surrounding scene uses the selected theme artwork. A shared ground anchor continues to join the lower shaft to the ground. Safe-area values fall back to browser environment insets and accept the Flutter handoff. Popups keep their title/close controls visible while content scrolls on compact or landscape screens. Startup asset failure offers reload before interactive play becomes available.

Verification completed on 2026-11-17

- Format, strict TypeScript/Vite build and 18 tests passed. New tests cover double start, exhausted rights, purchase idempotency, invalid quantity, insufficient points, failed purchase retry, catalog ownership, ranking and pending score accounting.
- Browser checks covered Home, Store purchase/selection, Settings on/off, Rules, Stats, Gifts, Ready, Playing, Game Over with/without rights, quantity changes, mock approval, success, insufficient points, request failure/retry, pending result and host preview. Browser error logs were empty at the end of those checks.
- Layouts were visually inspected at 320×568, 390×844, 844×390 and 1024×768. Visible image elements loaded successfully in the inspected states. Physical iOS/Android WebView testing of this update remains outstanding.
- Screenshots are in `docs/ui/implemented/`. Financial calls and server score verification remain assigned to the future production adapter.

## 2026-11-17 pipe collar alignment fix

The pipe renderer now crops the supplied `assets/sono/pipe.png` using a complete 327-pixel stripe repeat and its matching collar. Shaft and collar share one uniform scale and center. The upper shaft ends beneath the opaque snow, and the lower shaft overlaps the collar's bottom border before continuing eight logical pixels beneath the ground. This corrects the shifted collar edges, exposed joins and interrupted stripes from the earlier composite-sheet crops.

`npm run check` passed all 18 tests, formatting, TypeScript and the production build. Browser screenshots were inspected at 320×568, 390×844 and 1024×768. Runtime checks covered moving pipes and pooled reuse, matching horizontal centers, positive overlap at both joins, uniform collar scale and the ground overlap. Browser error logs were empty. The Ready screenshot in `docs/ui/implemented/ready.png` was refreshed. Physical iOS/Android WebView review of this fix remains pending.

## 2026-11-17 offline board and BRD V2.1

The updated Word document was read in full, including the revision table. It is V2.1 dated 2026-11-17, despite the filename containing 20261113. A project copy is retained at `docs/Flappy_sono_rules_v2.1_2026-11-17.docx`. The latest screen board is retained at `design-reference/ui-board-2026-11-17.png`. Current precedence and superseded product rules are recorded in `AGENTS.md` and `DECISIONS_AND_GAPS.md`.

Development now defaults to the isolated in-memory adapter because the user is away from the LAN backend. Root startup, nickname entry, play and sample life purchases work without backend calls. Explicit `?mode=api` retains the existing Player API adapter. Production defaults to API mode. Core finance and native authentication remain assigned to the servers and Flutter host.

Implemented 34 directly accessible review states at `?screens=1`. They cover host entry, nickname creation and duplicate feedback, Home music on/off, Ready with three/two rights, Playing, Game Over with/without rights, three skin cards plus unlocked/selected feedback, overall/today/previous/personal stats, buy warning, one/two-life quantities, points refresh, visual native confirmation, success/failure, Gifts, Rules, life ledger, host winner popup and Settings. Fixtures are isolated in `src/mock/`, route definitions in `src/preview/screens.ts`. The gallery loads 34 static WebP thumbnails totaling approximately 1.3 MB and creates zero Phaser canvases. Opening one card loads one game scene.

The supplied Mogul Square font was found in Downloads/Font and copied to the runtime fonts. Home and dialogs use it with Nunito for body text. The new layout preserves purple tabs/cards, green primary controls, supplied menu/character/pipe artwork, tabbed standings and separate balance cards. The lower pipe retains its uniform-scale collar crop and extends beneath the shared ground layer. Portrait, compact, landscape and wider-device popup content remains scrollable.

V2.1 preview rules now include free three at Ulaanbaatar midnight without carryover, free-before-earned spending, 20 sample SP per life, cumulative Santa 1,500 / Goldie 3,000 unlock and Store activation without a skin SP debit. Entry time chooses day 07:00–18:00 or night otherwise. The continuing speed series uses 10, 25, 45, 70, 100… cumulative thresholds and +0.1 per step. API runs still use server-issued configuration. The UI includes the full earned-right conditions from the Word document. Repayment-derived rights and actual rewards require server processing.

Verification completed for this update

- `npm run check` passed formatting, 30 Node tests, strict TypeScript and Vite production build. Vite continues to report the existing large Phaser vendor chunk warning.
- Added regression coverage for cumulative skin boundaries, skin activation without point debit, free-before-earned spending, midnight reset/no carryover, day/night boundaries, continuing speed thresholds, nickname validation/duplicate/one-time rules and API ownership gating.
- Browser loaded all 34 routes at 390×844. Each reported the intended state, zero JavaScript errors, zero broken image elements, zero horizontal page overflow and zero requests to 192.168.1.196. Screenshots are in `public/previews/`.
- Browser reviewed six states across 320×568, 390×844, 402×874, 844×390, 768×1024 and 1024×768, totaling 36 layout checks. Visible dialogs stayed inside the viewport, long content was scrollable, and lower shafts reached the shared ground on all checked layouts.
- Native inset simulation at 390×844 with top 54/bottom 34 retained a full canvas, safe controls and grounded pipes.
- Browser followed duplicate nickname → valid Mongolian nickname → Ready → Playing → collision → Game Over. Three games depleted all free rights. Buying two sample lives deducted 40 from 5,000 SP once, produced two earned rights and returned to Ready. The visual PIN sheet contained zero inputs and zero keypad buttons. No API requests were issued.
- Browser activated Goldie from the cumulative 3,000 fixture, preserving the 5,000 sample SP balance.
- Gallery checked 34 loaded thumbnails, ten groups and zero canvases. All links open the corresponding state. Production build served on a separate preview port also loaded the buy-two state with the supplied font, 40 SP cost, zero errors/broken images/LAN calls, and all 34 gallery thumbnails.

`ASSET_PENDING` includes the final FLAPPY SONO/FYN marks, exact footer icons, rank character interiors, final night artwork, the twelve planned theme/time variants and dedicated Santa/Goldie wing poses. Text, numbered medals, reused supplied art and a night tint are explicit placeholders. Prize art and all history values are sample fixtures. Daily/history/catalog ownership endpoints, real native callbacks, trusted score validation, finance and physical Flutter iOS/Android review remain pending. No financial rewards are enabled.

## 2026-11-17 Fine Gold source integration and audit

The user selected Figma section `Тоглоом fine gold`, node `168:9379`, as the current visual source and requested the full rules/code/UI correction pass. The Figma connector hit its Starter-plan call limit. The user's open Safari editor supplied a fresh local copy. Its save stalled at Downloading images 31/31, and Save partial file produced a valid archive. Extraction confirmed all 45 bitmap references in the requested section, along with 1,463 section nodes. Original assets, the archive, scene nodes, image hashes and the runtime-node mapping are preserved in `design-reference/figma-fine-gold/`.

Nineteen individual runtime assets now replace the temporary wordmark, footer symbols, numeric rank-ring placeholders and generic prize art. Logo layers use their original Figma crop transforms, icons retain original outlined geometry, and raster exports preserve alpha. The new runtime art totals approximately 274 KB. Mogul Square Regular is bundled and matches the source file's game typography. Home proportions, dialog background positioning, source colors, layered sponsor and safe-area behavior were corrected. Underlying Home/Game Over controls are hidden while a modal is open. The whole-screen reference images remain outside runtime rendering.

The audit fixed pending-start/background/exit races, tied delayed connectivity failures to their originating run, unified Ready and gameplay pipe gaps, preserved clearance-to-bird ratios during resize, and constrained the first obstacle to a reachable opening. Obsolete 25-pipe theme/50-100-200 skin helper rules were removed. The continuing V2.1 speed function drives the mock, while API games keep their server configuration.

API and UI fixes preserve HTTP status through gateway errors, validate server configs, share concurrent finish/order-check/native-payment work, retain lost-order intent and stable retry keys, reconcile restored order state, and recover one-time nickname saves after a lost response. Payment polling resumes after a transient failure. Leaderboard recovery clears old errors and preserves scroll/focus. Buy refresh errors are visible. Pending run starts show a disabled busy start button. Escape closes the topmost dialog and focus stays usable after dialog transitions.

Mock standings, score history and free/earned life ledgers now update with completed operations and day rollover. Preview milestone totals reconcile with daily history, and duplicate operations add one record. API daily/history/catalog data remains pending its corresponding endpoints. No financial reward authority was added to the client.

Verification for this pass

- `npm run check` passed Prettier, 38 Node tests, strict TypeScript and Vite production build. The existing Phaser vendor-chunk warning remains.
- All 34 screen routes loaded with zero captured JavaScript/unhandled errors, zero broken images, zero horizontal overflow and zero requests to the unavailable LAN backend. All thumbnails were regenerated in `public/previews/`.
- Eight states were checked across 320×568, 390×844, 402×874, 844×390, 768×1024 and 1024×768, totaling 48 layout checks. Dialogs and Home controls stayed within the viewport, long content scrolled, and pipes stayed grounded. An additional compact 320×568 check with top 54/bottom 34 safe insets kept the logo, music and menu controls separate.
- Browser delayed a start response, backgrounded the run, then released the response. The run finalized once at zero score, rights were spent once, and Game Over remained terminal.
- Browser retried a simulated transport failure in the API purchase path using the isolated mock service. Both requests retained the same UUID and payload, and only one 20-SP debit/one-right grant occurred.
- Browser payment polling recovered from one simulated connection error and reached success on the second check. Leaderboard failed once, retried successfully and cleared the error. A minute-refresh callback retained scrollTop 80 and the focused previous-day control.
- A live-phase pipe changed from 390×844 to the centered 480×390 landscape corridor. The logical gap remained 150 relative to bird scale, with a finite bird position and grounded shaft.

Remaining gaps are final night/theme artwork, Santa/Goldie wing pose layers, native Flutter token/payment integration, additional server endpoints, trusted score verification, real financial callbacks and physical-device/load/security checks. The offline review states use sample data and approval. The source's gold-prize quantities are displayed as a design example.


## 2026-11-18 final recovery and deployment checks

The final audit fixed missing-order recovery on definitive 404 ORDER_NOT_FOUND, kept transient/unrelated failures retryable, and reconciled preview right balances with their life ledgers. Daily free-right expiry now has corresponding mock ledger debits. UI payment completion moves focus to the new terminal panel. Delayed preparation results respect navigation/background changes, preparation controls expose their waiting state, and Settings music changes update the Home indicator immediately.

`npm run check` passed formatting, 41 tests, strict TypeScript and the root production build. A separate production build with base `/sono-play/` loaded all 34 screen states with their intended state IDs, the Mogul Square font, zero captured JavaScript errors, zero missing images, valid viewport bounds, correct asset paths and zero LAN backend requests. Its gallery loaded 34 thumbnails and correct relative links with zero Phaser canvases.

Browser checks additionally verified a stale order's error card returns to a fresh successful order, a Home choice survives a delayed prepare response, Settings/Home music indicators agree, and asynchronous PAID completion focuses its new action button. Native Flutter and live core callbacks remain pending the vendor's actual integration.

The menu background was exported at 1811×2560 while preserving its aspect ratio, reducing its approximate decoded RGBA footprint from 45 MB to 18 MB. The supplied 633×2116 pipe is served as lossless WebP at the same dimensions and crop coordinates, reducing transfer bytes from 678,280 to 502,288. Original source artwork remains in the design reference. The existing Phaser vendor-chunk warning remains in Vite output.

The requested file and connection list is in `docs/REQUIRED_FILES_AND_CONNECTIONS.mn.md`, including present files, final missing art, all 12 current Player API endpoint paths, proposed additional data, Flutter bridge/insets/lifecycle, and Play/Core responsibilities. The Figma connector continued to report its Starter-plan limit during the follow-up. The retrieved Fine Gold source contains all 45 section bitmap references used for the asset audit.


## 2026-11-18 live Swagger and server-owned Store

The LAN Player API became reachable again. Its current 14-path contract is preserved in `docs/api/player-openapi-2026-11-18.json`. The newly supplied `GET /api/v1/birds` and `PUT /api/v1/me/bird` now drive API Store names, cumulative thresholds, unlocked state and persisted selection. Known server codes map to the supplied Pilot/Santa/Goldie art. Selection waits for the server. Catalog failures offer retry, unknown codes have an artwork-pending card, and an older response cannot overwrite a confirmed selection or restore ownership from a previous tournament. Locked saved choices normalize the displayed selection to the available default.

Development once again defaults to API mode at port 5177. Explicit mock and screen routes remain isolated. The environment template and vendor/file/connection documents were brought up to date. The live `local-dev` catalog uses 0/50/150, while BRD V2.1 and the mock use 0/1,500/3,000. The backend config must be aligned before release. The live speed config has a maximum factor of 2 and a finite threshold list; API games continue using that issued config.

Verification for this follow-up

- `npm run check` passed Prettier, all 49 tests (including 24 API tests), strict TypeScript and Vite production build. The existing Phaser vendor-chunk warning remains.
- Live browser requests passed auth exchange, nickname creation/reload, profile/tournament/price/catalog reads, default bird activation and persisted selection. Direct authenticated development calls returned 200 for the default, 409 BIRD_LOCKED for Santa and 404 BIRD_NOT_FOUND for an unknown code.
- Two actual browser runs cleared 0 and 2 pipe pairs. Both finished once with server FINISHED, reducing free rights from 3 to 2 to 1. The second run used timed flap inputs against live geometry; neither its score nor its result payload was altered. The cumulative total 2 and own leaderboard row survived reload. `verifiedScore` stayed null.
- A one-life 20-SP order reached PENDING, granted no life and restored after reload. No native approval, core callback or reward operation was invoked.
- The LAN briefly timed out in both curl and browser, then returned 200 again. Store displayed a Mongolian timeout/retry message. A browser-injected connection error followed by retry also restored the live catalog and usable focus with zero captured errors.
- All 34 isolated review routes loaded at 390×844 with their intended state, zero captured JavaScript errors, zero broken images, zero page overflow and zero LAN requests. Store stayed inside 320×568, 844×390 and 768×1024 viewports. Offline unlocked Santa activation preserved the sample SP balance and focused the success action.
- Injected-transport regressions cover server unlocks, reload selection, tournament relocking, catalog failure/recovery, unknown art codes, failed/lost PUT responses, mismatched selection responses and stale concurrent reads.

Native Flutter launch/payment callbacks, core settlement, authoritative score/reward validation, missing daily/history/SP/prize endpoints, final night/skin wing art and physical-device/load/security verification remain pending. Current live QA used mock-profile development accounts only.


## 2026-11-18 nickname field focus correction

The user reported a duplicated blue shape on the nickname input. Browser inspection reproduced the user-agent automatic blue outline around only the input, inside its larger purple field. It also found the submit arrow inherited the card's purple text color and disappeared against the purple fill. The input now has a transparent background and no inner browser outline; focus is indicated by one pale-purple ring around the complete input/button group. The arrow has explicit white text and remains within the group.

Browser checks passed focused layout at 320×568, 390×844 and 844×390 with no page overflow and the dialog inside the viewport. Clicking the visible arrow saved an isolated mock nickname and focused the success action. `npm run check` passed Prettier, all 49 tests, TypeScript and production build. No new test files were added for this CSS correction.

Production deployment and Flutter/Play/Core handoff are described in `docs/PRODUCTION_DEPLOYMENT.mn.md`. Its domain names and infrastructure paths are proposals; no remote deployment or financial activation was performed.


## 2026-11-18 rendering, asset cache and deployment pass

Implemented the user's requested cache/rendering improvements. `src/renderPerformance.ts` manages static render sleep, deferred repaint/wake and coalesced viewport updates. Home and settled Game Over stop requesting Phaser frames; Ready/Playing remain continuous and smoke/body effects finish before sleep. Background layers reuse a key based on theme, dimensions and the derived ground line. Meaningful resize updates geometry before the frame's collision simulation. Page hide terminates active gameplay and sleeps rendering; page show repaints without resuming the terminated run. Fixed 120 Hz physics and financial/score authority boundaries remain unchanged.

`src/performance.ts` provides opt-in development diagnostics at `?mode=mock&perf=1`, with `window.__SONO_PERFORMANCE__.snapshot()` and `.reset()`. It retains at most 1,800 frame intervals and reports active-game FPS, frame percentiles/stalls, total Phaser renders, background builds, texture/object counts and browser JS heap when available. It sends no telemetry and persists no player data. The build removes the diagnostic in production. JS heap is not GPU memory and desktop emulation is not physical Flutter profiling.

`build/runtime-assets.mjs` and `src/assets.ts` generate SHA-256-versioned paths for runtime images/fonts/thumbnails. Vite rewrites HTML/CSS paths before bundle hashes, dynamic game/UI/gallery paths use the shared helper, and missing/unregistered public references fail fast. The current build emits 83 versioned runtime files and a `release-manifest.json` with release ID, source mappings and full checksums for 91 output files. Existing font licenses are preserved. Original/reference artwork remains in `public/` and design-reference directories but is not copied wholesale into production. Formatting now includes the asset compiler.

`deploy/nginx.conf.example` separates immutable hash assets from revalidated HTML/manifest and private no-store API responses. It preserves auth/idempotency headers, handles a specific CORS origin without duplicate upstream CORS headers, and includes an optional same-origin gateway. `docs/CACHE_AND_PERFORMANCE.mn.md` covers release retention, header checks, diagnostics and a backend Redis plan separating shared Top 10 from authenticated own-rank data. This repository has no supplied Play backend source or VPS access; Redis and active hosting configuration were not deployed. Local Nginx is unavailable, so the target host must run `nginx -t` and verify real headers. Physical-device, server-load and Core integration checks remain pending.

Verification

- `npm run check` passed Prettier, all 59 tests, strict TypeScript and the production build. New tests cover timing-window bounds/pause behavior, resize scheduling, render/effect lifecycle, content hash stability/invalidation, manifest integrity, root/subpath paths, licenses and fail-fast missing files. The existing Phaser chunk-size warning remains.
- Browser observed an idle Home with no added renders over one second, repeated Ready entry keeping `backdropBuilds` at 1, and actual Ready bob/Playing animation. A collision retained seven smoke particles while rendering, then finished with zero particles and no further rendered frames. No captured JavaScript errors occurred.
- Thirty duplicate safe-area/resize signals retained the latest top54/bottom34 insets without rebuilding unchanged layers. During a live mock flight, portrait390×844 → landscape844×390 produced one background rebuild, retained the logical 150-unit opening and finite bird geometry, and stayed PLAYING until explicit exit. Synthetic pagehide/pageshow ended a run once, preserved spent rights and kept Game Over terminal.
- All 34 review states passed on the root production build and again under `/sono-play/`: intended state, supplied font, zero captured errors/broken images/page overflow/LAN requests, hashed image paths and zero production debug overlays. The subpath gallery loaded 34 versioned thumbnails with zero Phaser canvases and correct links.
- Six viewports (320×568, 390×844, 402×874, 844×390, 768×1024, 1024×768) retained finite geometry, canvas bounds and grounded lower shafts. Static preview frames slept after resize. All manifest file checksums were independently verified.

The checked root artifact is `dist/` (92 files including its manifest, approximately 6.55 MB uncompressed). Vendor source handoffs now explicitly include `build/` as well as `src/`, `public/` and build configuration. Deployment/performance links were added to README/vendor/integration/required-file documents. No real payment, reward or loan action was enabled.


## 2026-11-18 current UI API requirements inventory

At the user's request, inspected the current UI and fetched live Swagger successfully (HTTP 200). It now has 15 paths, adding `GET /api/v1/lives/history` since the earlier 14-path snapshot. Saved the fresh contract in `docs/api/player-openapi-2026-11-18-ui-audit.json` and the screen-by-screen list in `docs/UI_API_REQUIREMENTS.mn.md`. The new history contract is available but has not been wired to the frontend; its entries/cursor and repeated daily free allocation data are documented precisely. Daily/previous standings, personal score history, SP balance, rewards/winner metadata and payment failure reason remain contract/integration gaps. Existing documentation was updated to distinguish availability from frontend wiring. No runtime behavior or financial operation was changed, and no tests were added for this documentation-only inventory.


## 2026-11-18 variable-refresh startup clock correction

The user reported slow initial gameplay followed by sudden normal speed on every run on an iPhone 13 Pro, while another phone appeared normal. Browser/OS version and the physical device's actual frame cadence were not supplied. Inspection and deterministic replay of installed Phaser 3.90.0 confirmed a matching clock defect: its default smoothStep=true clamps deltas to the 60 Hz target while the reset/wake cooldown lasts 120 callbacks (and while its focus flag is false). A synthetic 30 FPS replay advanced about 3.94 simulation seconds in six real seconds, then recovered toward normal speed. This establishes the code mechanism; it does not identify the phone's measured FPS.

`GAME_FRAME_TIMING` now sets `smoothStep:false`, shared by the real Phaser.Game configuration and regression tests. The existing fixed120Hz simulation, 100ms long-frame cap, wake-time delta reset, server tuning and score boundaries remain in place. Gameplay uses actual frame elapsed time rather than the smoothed warmup delta. The opt-in development overlay/snapshot now includes rawFrameMs, gameFrameMs and clockSmoothing so device retests can reveal clock disagreement.

Verification

- `npm run check` passed formatting, all 65 tests, TypeScript and production build. Six new tests run the installed Phaser TimeStep across 30/60/120 FPS, frame-rate changes, focus transitions and repeated60-second sleep/wake gaps. Removing the explicit smoothing setting causes five of those tests to fail.
- Browser RAF-gated Ready runs at 30→30→60→120→30 measured simulation/wall-time ratios from 0.985 to 1.006, with raw and game delta agreeing and smoothing disabled. The frame boundary accounts for the small measurement differences.
- Actual local mock flights controlled by timed flap inputs cleared two pairs at both a measured29 FPS and115 FPS, taking approximately3.95 and3.97 wall seconds respectively. Both spent one right, returned Game Over, retained one backdrop build and produced no captured JavaScript errors. Scores and result payloads were not altered.
- The affected physical iPhone still needs a refreshed-page retest. The change corrects pacing across frame rates; actual rendering smoothness remains dependent on the device/browser and requires its measurements. No financial or server API behavior changed.

## 2026-11-18 adaptive rendering and selected-asset loading

Added `src/adaptivePerformance.ts` with four render profiles: high (DPR 1.5), balanced (DPR 1.25), economy (DPR 1.0), and low (DPR 1.0 with fewer effects). The app begins balanced. Gameplay frame intervals are evaluated in 2.5-second windows; sustained poor intervals lower DPR/effects with hysteresis, and six healthy windows restore one quality step. The renderer follows native `requestAnimationFrame`; no Phaser 30/60 FPS timer cap is imposed because browser/device refresh pacing produced visibly uneven intervals in the local review. Physics remains fixed at 60 Hz with the existing 33.3 ms elapsed-time cap; only renderer backing resolution and nonessential effects change.

Selected Santa/Gold and non-default gameplay backgrounds load only when needed; initial loading retains Pilot, split pipe sprites, and the default day background. The gameplay pipe shaft/cap are cropped into 366×327 and 448×204 PNGs: this reduces runtime pipe transfer from about 502 KB to 233 KB and decoded source pixels by about 84%. The full source sheet is retained outside the runtime manifest. Asset errors while changing selection fall back to Pilot/day art. Bird poses remain separate assets; a combined atlas is pending design/export support.

`npm run build` passed after these changes (TypeScript and Vite production bundle). The existing Phaser chunk-size warning remains. Physical iPhone 13 Pro, weak Android/Xiaomi, and iPad Flutter WebView frame traces are still required to tune profile thresholds. No gameplay scoring, server-issued game configuration, or financial behavior changed. Tests were not run in this pass.

## 2026-11-18 frame-cap regression correction

The user reported severe hitching immediately after the adaptive pass. Local devtools measurements with the runtime Phaser 60 FPS limit showed about 53 FPS / 21 ms p95 in one run and 42 FPS / 37.7 ms p95 in another. Removed the timer-based FPS limit and private `_limitRate` mutation; Phaser now follows native `requestAnimationFrame` while adaptive quality changes only DPR and nonessential smoke effects. The development overlay now reports the selected quality tier. A subsequent unthrottled local Chrome run measured 240 FPS / 4.4 ms p95 / zero frames over 33 ms; this is desktop-browser-only evidence and does not establish iPhone WebView performance. User must refresh the open test page; device traces remain needed.

## 2026-11-18 default bird artwork update

Replaced the default Pilot gameplay art and Store catalog thumbnail with the user's supplied 128×128, 7.5 KB `santa sono.webp`. Measured visible alpha bounds are 128×119 pixels; display size is normalized to 54.2×52.8 CSS pixels. Removed the four legacy 490×501 body/wing images and old 1173×1207 Pilot thumbnail from the runtime manifest. The single supplied image has no flap-pose artwork, so the default character's wing-frame animation is unavailable until matching small poses/atlas are supplied. Santa/Gold selections, physics, scoring and server behavior are unchanged.
# 2026-11-18 WebView performance checklist

User-supplied frame-rate checklist reviewed against the current Phaser implementation. Changed the simulation from 120 Hz / 100 ms catch-up to fixed 60 Hz / 33.3 ms cap; the server-provided gravity, jump, scroll, gap, spawn interval and speed thresholds remain authoritative in API mode. Removed per-step threshold-array allocation, reused Ready wing poses, and hoisted music note arrays. The existing Phaser real-time `smoothStep: false` correction remains. Canvas gameplay, pointerdown, touch-action, pooled pipes, cached backdrop and preloaded textures were already present. API-mode 30-second connectivity polling remains because strict-online is an approved rule; it is asynchronous and outside the render loop. Responsive layout remains adaptive rather than a fixed 360×640 canvas. Detailed evidence and device-test instructions: `docs/WEBVIEW_PERFORMANCE_AUDIT.mn.md`.

User-requested DPR and speed follow-up: Phaser Scale.NONE now renders at `min(devicePixelRatio, 2)` backing pixels while the camera/ScaleManager retain CSS-pixel gameplay coordinates. Explicit CSS sizing fixes DPR transitions back to 1. Browser QA checked 390×844 DPR 1/1.5/3, 320×568 DPR 3, 844×390 and 768×1024 DPR 2; there was no document overflow. The 390×844 DPR 3 canvas measured 780×1688 backing and 390×844 CSS, with camera zoom 2; a mock 120 FPS flight reported p95 8.7 ms for its first 54 frame intervals, backdrop build 1. Speed follows the API/mock threshold target over 0.4 seconds, never exceeding target; browser mock samples after 80/160/240/320/400 ms reached approximately 1.017/1.037/1.058/1.079/1.100. Backend SEC-02 replay/verification must adopt the same transition before any financial eligibility. Physical iPhone WebView and Android performance remain unverified.

2026-11-18 iPhone 13 Pro report: the user sees p95 18 ms near 60 FPS. This exceeds a 60 Hz frame budget (16.7 ms) and indicates missed frames. The cumulative render counter was expected frame activity, not memory growth; the opt-in display now shows a bounded frame window. Lowered the phone backing-pixel cap to 1.5 (DPR 3 canvas now 585×1266 for a 390×844 CSS viewport), reducing GPU pixel work versus the previous 780×1688 cap. User should refresh the WebView and retest. Physical-device result is not yet measured here.

2026-11-18 Canvas2D and skin scale: renderer is now fixed to Phaser Canvas 2D. Alpha-bounds from the supplied PNGs showed Santa/Gold opaque area at approximately 465×464/498×460 pixels, versus Pilot composite bounds of 359×348 inside 490×501. Added a shared body-size calculation so Pilot, Santa and Gold have approximately 54.2×52.8 CSS-pixel visible bounds; flap squash uses the matched local dimensions. Runtime browser inspection confirmed CanvasRenderer2, 390×844 CSS with 585×1266 backing at DPR 3, and Santa display size 54.22×58.25 (alpha-visible area matches Pilot). `npm run check`: formatting, 71 tests, TypeScript and build passed. Physical iPhone render/performance verification remains pending.

