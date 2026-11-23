# Flutter and Player API integration

This standalone frontend uses only the Player API adapter. It starts a server-issued game session, consumes the returned seed and physics config, and submits the run result for server validation. The displayed pipe count is not a trusted score and cannot grant points, lives, skins, or rewards.

## Host bridge

The SONO app injects `window.SonoBridge` before the page's scripts run (at document start, not in `onPageFinished`). The agreed shape, owned by the backend team's `docs/core-integration.md` §1, is one promise-returning entry point:

```js
window.SonoBridge.call(method, params) // → Promise<result>
```

`src/services/HostBridge.ts` also accepts the same methods as direct functions (`window.SonoBridge.getLaunchToken(params)`), so an early Flutter test host keeps working. No other global is read.

| Method | Params | Result | Used for |
|---|---|---|---|
| `getLaunchToken` | `{}` | `{ launchToken }` | Login (`POST /api/v1/auth/exchange`), and again whenever the session cannot be renewed. Fresh one-time token on every call, no user interaction. |
| `payWithPoints` | `{ orderId }` | `{ orderId, result: "COMPLETED" \| "CANCELLED" \| "FAILED" }` | The native PIN screen for an order. Only the order id is sent; Core reads the amount from the backend. `CANCELLED`/`FAILED` let the player start a new order at once; lives come only from the server's order status, never from this result. |
| `getPointBalance` | `{}` | `{ points }` | The balance on the buy screen, read when it opens and on its refresh button. Without it the balance is hidden and buying still works (Core checks the balance at its PIN screen). |
| `openExternalUrl` | `{ url }` | `{}` | The gift and guide buttons. Core opens only the allowlisted URLs below, outside the game WebView. |
| `close` | `{}` | – | Reserved; not called yet. |

PIN entry and Core credentials stay in native/Core code.

## External links

The gift and guide buttons call `openExternalUrl({ url })`. The host opens exactly these URLs (`EXTERNAL_URLS` in `src/services/HostBridge.ts`) with `url_launcher` in an in-app browser view or the external browser, and refuses any other: `https://www.finegold.mn/products`, `https://www.youtube.com`, `https://www.youtube.com/watch?v=q8edb6pi5GQ&t=346s`. The game WebView stays mounted, so returning to SONO keeps its current screen. If the host lacks the method, the page shows a message and does not navigate the game WebView away. In a normal browser preview the buttons open a new tab. The WebView navigation delegate should still cancel any navigation of the game WebView to another origin. A sample native pattern is:

```dart
Future<NavigationDecision> onNavigationRequest(NavigationRequest request) async {
  const allowed = {
    'https://www.finegold.mn/products',
    'https://www.youtube.com',
    'https://www.youtube.com/watch?v=q8edb6pi5GQ&t=346s',
  };
  if (allowed.contains(request.url)) {
    await launchUrl(Uri.parse(request.url), mode: LaunchMode.inAppBrowserView);
    return NavigationDecision.prevent;
  }
  final uri = Uri.tryParse(request.url);
  final sameOrigin = uri != null && uri.origin == gameOrigin;
  return sameOrigin ? NavigationDecision.navigate : NavigationDecision.prevent;
}
```

Register the same allowlist in the native `openExternalUrl` implementation. Do not let arbitrary URLs from JavaScript become native intents. The guide URL currently points to the YouTube home page as requested; replace it with a specific SONO instruction video when available, in both lists.

## Game results and the network

A flight needs no connection. The result (`score`, `durationMs`) is measured once at game over and sent then; if that fails (offline, app sent to the background, timeout), the same values are sent again when the page is visible or the network returns, and the server accepts a late result within the session's 15 minutes. Losing the connection mid-flight only shows a notice. A flight ends 30 s before the server's 15-minute session limit so the result still arrives in time.

The normal build always uses the Player API. It exchanges a fresh launch token with `POST /api/v1/auth/exchange`, holds the returned access token in page memory, and refreshes or exchanges a new launch token after expiry. Without a launch-token provider, the app reports that the SONO host is required. Local practice is explicit with `?practice=1`; its scores do not reach the API. For a backend running its mock profile, a separately built local preview can set `VITE_API_TEST_MOCK_AUTH=1`. That preview generates a stable anonymous test player and one-time mock launch tokens, then uses the real exchange and subsequent Player API routes. Each new tester chooses a nickname through `PUT /api/v1/me/nickname` before playing. The preview shows a `+10 ТЕСТ АМЬ` button that calls the backend's mock-only `POST /api/v1/dev/lives`. Ordinary refresh retains the current mock player and score. Never enable mock auth in a production build.

The Player API contract is in `docs/api/flappy-player-api.json` (exported from the backend; refresh it from the backend repository's `docs/openapi/` after every API change), with requests in `docs/api/flappy-player-api.postman_collection.json`. See `README_BACKEND.md`, `docs/SECURITY_SPEC.md`, and `docs/VENDOR_INTEGRATION_AGENDA.mn.md` for API ownership, hosting, and open decisions.

## WebView size and safe areas

The web app fits the actual `WebViewWidget` bounds, including changes from an app bar, rotation, keyboard, or split view. A device screenshot from a browser simulator includes the browser's address and tool bars; those are not part of the game viewport in a Flutter host. Flutter should size the WebView to its intended game area and apply safe areas once, for example `SafeArea(child: WebViewWidget(controller: controller))` inside the route body. If Flutter has already applied `SafeArea`, do not also inject `window.__SONO_SAFE_AREA__`; that would subtract the same inset twice. If the WebView is deliberately edge to edge, pass the unconsumed native insets via `window.__SONO_SAFE_AREA__` and dispatch `sono-safe-area` after changes, or rely on the WebView's CSS `env(safe-area-inset-*)` when it reports them correctly. Test on the actual SONO Flutter host with a notch, home indicator, app bar, and nickname keyboard.
