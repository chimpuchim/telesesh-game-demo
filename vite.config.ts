import { defineConfig } from 'vite';

const SERVER_URL = 'http://localhost:3001';

export default defineConfig({
  root: 'client',
  publicDir: false,
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
    sourcemap: false,
    // Phaser is a single ~1.5 MB library; keep it in its own long-cacheable chunk.
    chunkSizeWarningLimit: 1700,
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': SERVER_URL,
      '/socket.io': { target: SERVER_URL, ws: true },
    },
  },
});
