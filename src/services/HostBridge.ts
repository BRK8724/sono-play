import { newId } from './uuid';
import { ApiError } from './ApiClient';

export type HostBridge = {
  getLaunchToken(): Promise<string | { launchToken: string }>;
  payWithPoints?(request: { orderId: string }): Promise<unknown>;
};

export function hostBridge(): HostBridge | undefined {
  const host = window as typeof window & { SonoBridge?: HostBridge; bridge?: HostBridge };
  return host.SonoBridge ?? host.bridge;
}

export function developmentPlayer() {
  try {
    let id = localStorage.getItem('sono.dev-player');
    if (!id) {
      id = `web_${newId()}`;
      localStorage.setItem('sono.dev-player', id);
    }
    return id;
  } catch {
    return `web_${newId()}`;
  }
}

export async function launchToken(devUser?: string) {
  const bridge = hostBridge();
  if (bridge) {
    const result = await bridge.getLaunchToken();
    return typeof result === 'string' ? result : result.launchToken;
  }
  if (devUser) return `mock:${devUser}:${newId()}`;
  throw new ApiError('HOST_REQUIRED');
}
