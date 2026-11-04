import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      // Short lifetimes so expiry paths run in real time.
      miniflare: { bindings: { TTL_QR: '1', TTL_UPLOAD: '1', TTL_RESULT: '1', TTL_APPLYING: '1', TTL_TOMBSTONE: '1' } },
    }),
  ],
});
