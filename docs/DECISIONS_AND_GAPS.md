# Product and integration decisions still open

## Approved client behavior

- One successfully cleared pipe pair adds one displayed point. This count stays client-side and does not represent a verified score.
- Each run uses the Player API session ID, seed, and physics configuration. The server validates and records the result.
- The server owns free/earned rights, point pricing, bird ownership/unlocks, order state, standings, and rewards.
- The SONO Flutter host supplies a short-lived launch token. PIN entry and core credentials remain native/server-side.
- The WebView does not call the API per tap or frame, grant rights, or calculate financial eligibility.

## Release blockers

- Backend must finalize SEC-02 authoritative score validation and any reward eligibility rules. No client-reported score may trigger financial value.
- Core and Play owners must finalize signed, idempotent payment/repaid-loan events and reconciliation. The provided Player API schema does not define the Core callbacks.
- The Flutter vendor must implement and verify the `SonoBridge` launch-token and optional native payment callbacks on iOS and Android.
- Current Player API support for standings/history, point balance, prize metadata, and `/api/v1/lives/history` must be reconciled against the UI contract and deployment environment.
- Backend must align tournament skin unlock thresholds and game configuration with the signed-off product rules. The frontend follows server catalog/config values and does not override them.
- The supplied day, evening, and night artwork and Gold SONO wing poses are integrated. Matching poses for the other birds and any additional approved theme variants remain asset dependencies.
- Physical-device WebView testing, security review, and capacity/load testing remain release gates.

## Ownership

The mini app is a static Flutter WebView frontend. Vendor hosts its HTTPS assets; the Play service owns game sessions and the Player API; SONO Core owns identity and financial ledger operations. Production endpoint, origins, callback signatures, rollback policy, and on-call ownership are supplied by the participating teams.
