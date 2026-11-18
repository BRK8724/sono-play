# Flappy SONO — security specification v1.2

## Approved SEC decisions
| ID | Control | Decision | Owner |
|---|---|---|---|
| SEC-01 | Connectivity | Strict online; disconnect timeout -> terminal run; only verified score persists | Client + server |
| SEC-02 | Score validation | **UNDECIDED, Backend Team**. Do not treat client score as proof | Backend |
| SEC-03 | Background | App inactive/background -> terminal Game Over, verified score | Flutter + backend |
| SEC-04 | Integrity | Allow play; suspicious integrity -> hold reward for review | Native + backend |
| SEC-05 | Debugging | Disable production WebView debugging (minimal approved choice) | Flutter |
| SEC-06 | Bot | Flag suspect session; hold reward pending verification | Backend |
| SEC-07 | Replay | One-time session + expiry + nonce + monotonic event sequence | Both, server validates |
| SEC-08 | Multidevice | One active game session/account (atomic enforce) | Backend |
| SEC-09 | Recording | Screenshot and screen recording allowed | Client |
| SEC-10 | Claim | Automatic backend reward only once/idempotent | Backend/finance |
| SEC-11 | Files | HTTPS + CSP + asset manifest + signed release/version | Web delivery + backend |
| SEC-12 | Network UX | Connection Lost + verified score + Retry | Client |
| SEC-13 | Review UX | Score Pending Verification; reward held | Client + backend |

## Never do
- Do not send `clientScore` to a reward API and treat HTTP 200 as financial approval.
- Do not keep loan authorization, SONO PIN, signing secrets, or refresh tokens in WebView JavaScript.
- Do not infer trusted score from localStorage, pause/resume or a cached page.
- Do not rely on rooting checks, obfuscation, CSP or TLS alone as anti-cheat.

## Integration contract — NOT YET IMPLEMENTED
`POST /game-sessions` obtains opaque short-lived credential and server-issued game configuration; `POST /game-sessions/:id/events` conveys monotonic input sequence; `POST /game-sessions/:id/terminate` reports app background/disconnect/impact; `GET /game-sessions/:id/result` returns `verificationStatus`, `verifiedPipeScore`, `rewardStatus`; `GET /leaderboard?limit=10` returns verified scores + own rank. Actual protocol/crypto and retry semantics MUST be approved by backend.

## QA priorities
Offline toggling, reconnect, hidden/paused tab, simultaneous devices, replayed sequence, altered JS, modified app, synthetic tap bot, fake score 9999, multiple reward deliveries, delayed result, transaction failure, kill/restart during buy, PIN outside WebView, integrity false positive.
