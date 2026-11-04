// wrangler needs the assets directory to exist; tests and dev work before the web build.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const dir = new URL('../../web/dist/', import.meta.url);
if (!existsSync(new URL('index.html', dir))) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('index.html', dir), '<!doctype html><title>build the web package</title>');
}
