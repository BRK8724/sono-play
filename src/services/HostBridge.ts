import { ApiError } from './ApiClient';

/**
 * The SONO app's JS bridge (backend repository, docs/core-integration.md §1). The documented shape is
 * `window.SonoBridge.call(method, params): Promise<result>`. A host that exposes the same methods
 * directly (`window.SonoBridge.getLaunchToken(params)`) is accepted too.
 */
export type HostMethod =
  'getLaunchToken' | 'payWithPoints' | 'getPointBalance' | 'openExternalUrl' | 'close';
export type PaymentOutcome = 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'UNKNOWN';

type Bridge = {
  call?: (method: HostMethod, params: object) => Promise<unknown> | unknown;
} & Partial<Record<HostMethod, (params: object) => Promise<unknown> | unknown>>;

/** The only pages the host may open for the mini app; the host keeps the same allowlist. */
export const EXTERNAL_URLS = [
  'https://www.finegold.mn/products',
  'https://www.youtube.com',
  'https://www.youtube.com/watch?v=q8edb6pi5GQ&t=346s',
] as const;
export type ExternalUrl = (typeof EXTERNAL_URLS)[number];

function bridge(): Bridge | undefined {
  const value = (window as typeof window & { SonoBridge?: unknown }).SonoBridge;
  return value && typeof value === 'object' ? (value as Bridge) : undefined;
}

export function hasHost() {
  return Boolean(bridge());
}

/** With `call` every documented method exists; a direct bridge shows what it implements. */
export function hostSupports(method: HostMethod) {
  const host = bridge();
  if (!host) return false;
  return typeof host.call === 'function' || typeof host[method] === 'function';
}

async function callHost(method: HostMethod, params: object = {}): Promise<unknown> {
  const host = bridge();
  if (!host) throw new ApiError('HOST_REQUIRED');
  if (typeof host.call === 'function') return host.call(method, params);
  const direct = host[method];
  if (typeof direct !== 'function') throw new ApiError('HOST_METHOD_UNAVAILABLE');
  return direct.call(host, params);
}

/** A fresh one-time launch token for `POST /api/v1/auth/exchange`. */
export async function launchToken() {
  const result = await callHost('getLaunchToken');
  const token =
    typeof result === 'string' ? result : (result as { launchToken?: unknown } | null)?.launchToken;
  if (typeof token === 'string' && token.trim()) return token;
  throw new ApiError('INVALID_LAUNCH_TOKEN');
}

/**
 * Opens the host's PIN screen for an order. Only the order id goes to the host; it reads the amount
 * from the backend. The outcome is for the UI only: lives come from the server's order status.
 */
export async function payWithPoints(orderId: string): Promise<PaymentOutcome> {
  const result = await callHost('payWithPoints', { orderId });
  const outcome = (result as { result?: unknown } | null)?.result;
  return outcome === 'COMPLETED' || outcome === 'CANCELLED' || outcome === 'FAILED'
    ? outcome
    : 'UNKNOWN';
}

/** The player's SONO point balance for the store, or null when the host cannot tell. */
export async function pointBalance(): Promise<number | null> {
  if (!hostSupports('getPointBalance')) return null;
  try {
    const result = await callHost('getPointBalance');
    const points =
      typeof result === 'number' ? result : (result as { points?: unknown } | null)?.points;
    return typeof points === 'number' && Number.isSafeInteger(points) && points >= 0
      ? points
      : null;
  } catch {
    return null;
  }
}

/** Keep third-party pages outside the game WebView so a return keeps the run state. */
export async function openExternalUrl(url: ExternalUrl) {
  if (!EXTERNAL_URLS.includes(url)) throw new ApiError('HOST_EXTERNAL_URL_UNAVAILABLE');
  if (!hasHost()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  if (!hostSupports('openExternalUrl')) throw new ApiError('HOST_EXTERNAL_URL_UNAVAILABLE');
  try {
    await callHost('openExternalUrl', { url });
  } catch {
    throw new ApiError('HOST_EXTERNAL_URL_UNAVAILABLE');
  }
}
