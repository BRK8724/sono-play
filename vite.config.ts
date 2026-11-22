import { defineConfig } from 'vite';
import { runtimeAssetsPlugin } from './build/runtime-assets.mjs';

export default defineConfig({
  plugins: [runtimeAssetsPlugin()],
  build: {
    // Older Flutter WebViews can run ES modules but need newer syntax transformed.
    target: ['chrome87', 'edge88', 'firefox78', 'safari14', 'ios14'],
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
});
