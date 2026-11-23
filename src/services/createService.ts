import { ApiClient } from './ApiClient';
import { ApiMiniappService } from './ApiMiniappService';
import { hostSupports, launchToken, payWithPoints, pointBalance } from './HostBridge';
import type { MiniappService } from './MiniappService';
import { GuestService } from './GuestService';
import { createLocalMockService } from './LocalMockApi';
import { newId } from './uuid';

// Only the explicitly flagged local preview uses the backend's mock profile.
// The identifier is not a credential; every exchange gets a fresh one-time nonce.
let previewUser = '';
const previewUserKey = 'sono.preview.user';
function previewLaunchToken() {
  if (!previewUser) {
    try {
      previewUser = localStorage.getItem(previewUserKey) ?? '';
      if (!/^web_[a-f0-9]{16}$/.test(previewUser)) {
        previewUser = `web_${newId().replaceAll('-', '').slice(0, 16)}`;
        localStorage.setItem(previewUserKey, previewUser);
      }
    } catch {
      previewUser = `web_${newId().replaceAll('-', '').slice(0, 16)}`;
    }
  }
  return `mock:${previewUser}:${Date.now()}_${newId()}`;
}

const mockAuth = import.meta.env.VITE_API_TEST_MOCK_AUTH === '1';

const apiService: MiniappService = new ApiMiniappService({
  client: new ApiClient({
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
    getLaunchToken: () => (mockAuth ? Promise.resolve(previewLaunchToken()) : launchToken()),
  }),
  testLivesEnabled: mockAuth,
  paymentAvailable: () => hostSupports('payWithPoints'),
  payWithPoints: ({ orderId }) => payWithPoints(orderId),
  pointBalance,
});

const previewMode = new URLSearchParams(window.location.search);
export const service: MiniappService =
  import.meta.env.VITE_LOCAL_MOCK_API === '1' && previewMode.get('mock') === '1'
    ? createLocalMockService()
    : previewMode.get('practice') === '1'
      ? new GuestService()
      : apiService;
