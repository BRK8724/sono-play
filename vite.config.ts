import { defineConfig, loadEnv } from 'vite';
import { runtimeAssetsPlugin } from './build/runtime-assets.mjs';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const apiOrigin = loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL ?? '';
    if (apiOrigin) {
      let valid = false;
      try {
        const url = new URL(apiOrigin);
        valid =
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          url.pathname === '/' &&
          !url.search &&
          !url.hash &&
          apiOrigin === apiOrigin.trim();
      } catch {
        // An invalid URL is reported by the same build error below.
      }
      if (!valid)
        throw new Error(
          'VITE_API_BASE_URL must be an HTTPS origin, or empty for a same-origin /api/v1 proxy.',
        );
    }
  }
  return {
    plugins: [runtimeAssetsPlugin()],
    build: {
      // Older Flutter WebViews can run ES modules but need newer syntax transformed.
      target: ['chrome87', 'edge88', 'firefox78', 'safari14', 'ios14'],
      rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
    },
  };
});
