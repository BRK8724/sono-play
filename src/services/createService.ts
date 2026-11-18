import { MockMiniappService } from '../mock/MockMiniappService';
import { ApiClient, ApiError } from './ApiClient';
import { ApiMiniappService } from './ApiMiniappService';
import { developmentPlayer, hostBridge, launchToken } from './HostBridge';
import type { MiniappService } from './MiniappService';

const devAuth = import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE === 'mock';
export const devUser = devAuth ? developmentPlayer() : undefined;
const params = new URLSearchParams(location.search);
const previewMode =
  params.has('screen') ||
  params.has('screens') ||
  params.get('mode') === 'mock' ||
  (import.meta.env.VITE_SERVICE_MODE === 'mock' && params.get('mode') !== 'api');
export const service: MiniappService = previewMode
  ? new MockMiniappService({ requireNickname: !params.has('screen') })
  : new ApiMiniappService({
      client: new ApiClient({
        baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
        getLaunchToken: () => launchToken(devUser),
      }),
      paymentAvailable: () => Boolean(hostBridge()?.payWithPoints),
      payWithPoints: async (request) => {
        const bridge = hostBridge();
        if (!bridge?.payWithPoints) throw new ApiError('HOST_PAYMENT_REQUIRED');
        return bridge.payWithPoints(request);
      },
      dev: devAuth,
    });
