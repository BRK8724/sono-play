import { defineConfig } from 'vite';
import { runtimeAssetsPlugin } from './build/runtime-assets.mjs';

export default defineConfig({
  plugins: [runtimeAssetsPlugin()],
  build: {
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
});
