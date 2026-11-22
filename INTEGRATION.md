# Flutter and Player API integration

This standalone frontend uses only the Player API adapter. It starts a server-issued game session, consumes the returned seed and physics config, and submits the run result for server validation. The displayed pipe count is not a trusted score and cannot grant points, lives, skins, or rewards.

Flutter provides `window.SonoBridge.getLaunchToken()` for a short-lived app launch token. When native payment confirmation is enabled, Flutter can expose `window.SonoBridge.payWithPoints({ orderId })`; the web app then checks the Player API order until the server confirms its state. PIN entry and Core credentials stay in native/Core code.

The gift and guide buttons call `window.SonoBridge.openExternalUrl({ url })` when Flutter provides it. Flutter should allow only `https://www.finegold.mn/products` and `https://www.youtube.com`, then open them with `url_launcher` in an in-app browser view or external browser. The game WebView stays mounted, so returning to SONO keeps its current screen. The Flutter WebView navigation delegate should also intercept those two URLs as a fallback and cancel navigation in the game WebView. In a normal browser preview the buttons open a new tab; if an older Flutter host lacks `openExternalUrl`, the web page navigates to the URL so the delegate can catch it. A sample native pattern is:

```dart
Future<NavigationDecision> onNavigationRequest(NavigationRequest request) async {
  final uri = Uri.tryParse(request.url);
  final external = uri?.scheme == 'https' &&
      ((uri?.host == 'www.finegold.mn' && uri?.path == '/products') ||
       (uri?.host == 'www.youtube.com' && uri?.path == '/'));
  if (!external) return NavigationDecision.navigate;
  await launchUrl(uri!, mode: LaunchMode.inAppBrowserView);
  return NavigationDecision.prevent;
}
```

Register the same allowlist in the native `openExternalUrl` implementation. Do not let arbitrary URLs from JavaScript become native intents. The guide URL currently points to the YouTube home page as requested; replace it with a specific SONO instruction video when available.

The normal build always uses the Player API. It exchanges a fresh launch token with `POST /api/v1/auth/exchange`, holds the returned access token in page memory, and refreshes or exchanges a new launch token after expiry. Without a launch-token provider, the app reports that the SONO host is required. Local practice is explicit with `?practice=1`; its scores do not reach the API. For a backend running its mock profile, a separately built local preview can set `VITE_API_TEST_MOCK_AUTH=1`. That preview generates a stable anonymous test player and one-time mock launch tokens, then uses the real exchange and subsequent Player API routes. Each new tester chooses a nickname through `PUT /api/v1/me/nickname` before playing. The preview shows a `+10 ТЕСТ АМЬ` button that calls the backend's mock-only `POST /api/v1/dev/lives`. Ordinary refresh retains the current mock player and score. Never enable mock auth in a production build.

The Player API contract is in `docs/api/player-openapi-2026-11-18-ui-audit.json`. See `README_BACKEND.md`, `docs/SECURITY_SPEC.md`, and `docs/VENDOR_INTEGRATION_AGENDA.mn.md` for API ownership, hosting, and open decisions.

## WebView size and safe areas

The web app fits the actual `WebViewWidget` bounds, including changes from an app bar, rotation, keyboard, or split view. A device screenshot from a browser simulator includes the browser's address and tool bars; those are not part of the game viewport in a Flutter host. Flutter should size the WebView to its intended game area and apply safe areas once, for example `SafeArea(child: WebViewWidget(controller: controller))` inside the route body. If Flutter has already applied `SafeArea`, do not also inject `window.__SONO_SAFE_AREA__`; that would subtract the same inset twice. If the WebView is deliberately edge to edge, pass the unconsumed native insets via `window.__SONO_SAFE_AREA__` and dispatch `sono-safe-area` after changes, or rely on the WebView's CSS `env(safe-area-inset-*)` when it reports them correctly. Test on the actual SONO Flutter host with a notch, home indicator, app bar, and nickname keyboard.
