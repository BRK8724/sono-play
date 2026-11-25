import { ApiClient } from './ApiClient';
import { ApiMiniappService } from './ApiMiniappService';
import { hostSupports, launchToken, payWithPoints, pointBalance } from './HostBridge';
import type { MiniappService } from './MiniappService';

export const service: MiniappService = new ApiMiniappService({
  client: new ApiClient({
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
    getLaunchToken: launchToken,
  }),
  paymentAvailable: () => hostSupports('payWithPoints'),
  payWithPoints: ({ orderId }) => payWithPoints(orderId),
  pointBalance,
});
