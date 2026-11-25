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

The gift and guide buttons call `openExternalUrl({ url })`. The host opens exactly the two URLs in `EXTERNAL_URLS` (`src/services/HostBridge.ts`) with `url_launcher` in an in-app browser view or the external browser, and refuses any other. **Бэлэг харах** opens `https://www.finegold.mn/products`; **Заавар үзэх** opens the supplied `https://onelink.to/xnesvy?...` link, including its `fbclid` query. The game WebView stays mounted, so returning to SONO keeps its current screen. If the host lacks the method, the page shows a message and does not navigate the game WebView away. The WebView navigation delegate should still cancel any navigation of the game WebView to another origin. A sample native pattern is:

```dart
Future<NavigationDecision> onNavigationRequest(NavigationRequest request) async {
  const allowed = {
    'https://www.finegold.mn/products',
    'https://onelink.to/xnesvy?fbclid=IwZXh0bgNhZW0CMTAAcGRvZgVicmlkETFWRzhzZHcwRWc4Y2JwbldOc3J0YwZhcHBfaWQQMjIyMDM5MTc4ODIwMDg5MgABH_KQM3dP0BaxI85LD1mw0oH3_PKbeL_k3ohDTA5fiSYlBh7zs_rIeh1JAyPj_aem_156NS9ix7M8TsJKF5gyQIg',
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

Register the same allowlist in the native `openExternalUrl` implementation. Do not let arbitrary URLs from JavaScript become native intents. The guide's OneLink redirect may continue to a browser or app store; handle that redirect in the external view, not in the game WebView.

## Game results and the network

A flight needs no connection. The result (`score`, `durationMs`) is measured once at game over and sent then; if that fails (offline, app sent to the background, timeout), the same values are sent again when the page is visible or the network returns, and the server accepts a late result within the session's 15 minutes. Losing the connection mid-flight only shows a notice. A flight ends 30 s before the server's 15-minute session limit so the result still arrives in time.

The frontend uses the Player API for every authenticated flow. It exchanges a fresh launch token from the SONO host with `POST /api/v1/auth/exchange`, holds the returned access token in page memory, and refreshes or exchanges a new launch token after expiry. Without a launch-token provider, the app reports that the SONO host is required. Each new player chooses a nickname through `PUT /api/v1/me/nickname` before playing. There is no guest or local account path.

The production Player API contract is in `docs/api/flappy-player-api.json` (derived from the backend export without development-only routes; refresh it after every API change). See `README_BACKEND.md`, `docs/SECURITY_SPEC.md`, and `docs/PRODUCTION_DEPLOYMENT.mn.md` for API ownership, hosting, and release requirements.

## WebView size and safe areas

The web app fits the actual `WebViewWidget` bounds, including changes from an app bar, rotation, keyboard, or split view. A device screenshot from a browser simulator includes the browser's address and tool bars; those are not part of the game viewport in a Flutter host. Flutter should size the WebView to its intended game area and apply safe areas once, for example `SafeArea(child: WebViewWidget(controller: controller))` inside the route body. If Flutter has already applied `SafeArea`, do not also inject `window.__SONO_SAFE_AREA__`; that would subtract the same inset twice. If the WebView is deliberately edge to edge, pass the unconsumed native insets via `window.__SONO_SAFE_AREA__` and dispatch `sono-safe-area` after changes, or rely on the WebView's CSS `env(safe-area-inset-*)` when it reports them correctly. Test on the actual SONO Flutter host with a notch, home indicator, app bar, and nickname keyboard.
