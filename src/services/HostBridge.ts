import { ApiError } from './ApiClient';

export type HostBridge = {
  getLaunchToken(): Promise<string | { launchToken: string }>;
  payWithPoints?(request: { orderId: string }): Promise<unknown>;
  openExternalUrl?(request: { url: string }): Promise<unknown> | void;
};

/** Keep third-party pages outside the game WebView so a return keeps the run state. */
export function openExternalUrl(
  url: 'https://www.finegold.mn/products' | 'https://www.youtube.com' | 'https://www.youtube.com/watch?v=q8edb6pi5GQ&t=346s',
) {
  const bridge = hostBridge();
  if (bridge?.openExternalUrl) return Promise.resolve(bridge.openExternalUrl({ url }));
  if (bridge) throw new ApiError('HOST_EXTERNAL_URL_UNAVAILABLE');
  window.open(url, '_blank', 'noopener,noreferrer');
  return Promise.resolve();
}

export function hostBridge(): HostBridge | undefined {
  const host = window as typeof window & { SonoBridge?: HostBridge; bridge?: HostBridge };
  return host.SonoBridge ?? host.bridge;
}

export async function launchToken() {
  const bridge = hostBridge();
  if (bridge) {
    const result = await bridge.getLaunchToken();
    const token = typeof result === 'string' ? result : result?.launchToken;
    if (typeof token === 'string' && token.trim()) return token;
    throw new ApiError('INVALID_LAUNCH_TOKEN');
  }
  throw new ApiError('HOST_REQUIRED');
}
