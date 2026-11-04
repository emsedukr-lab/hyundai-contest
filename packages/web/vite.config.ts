import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: { '@astryxdesign/theme-neutral/fonts.css': fileURLToPath(new URL('./src/fonts.css', import.meta.url)) },
  },
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1500 },
});
