import { describe, expect, it } from 'vitest';
import { carQrTarget } from './qrLink';

const origin = 'https://tteonaljido.tteonaljido-worker.workers.dev';
const id = 'A'.repeat(21) + 'b';
const good = `${origin}/c#v1.${id}.${id}.${id}`;

describe('car QR from the in-app scanner', () => {
  it("opens this app's car QR as the /c path", () => {
    expect(carQrTarget(good, origin)).toBe(`/c#v1.${id}.${id}.${id}`);
    expect(carQrTarget(`  ${good}\n`, origin)).toBe(`/c#v1.${id}.${id}.${id}`);
  });

  it('refuses another site, another path, a bad fragment or plain text', () => {
    expect(carQrTarget(good.replace(origin, 'https://evil.example'), origin)).toBeNull();
    expect(carQrTarget(`${origin}/trips#v1.${id}.${id}.${id}`, origin)).toBeNull();
    expect(carQrTarget(`${origin}/c#v2.${id}.${id}.${id}`, origin)).toBeNull();
    expect(carQrTarget(`${origin}/c#v1.short.${id}.${id}`, origin)).toBeNull();
    expect(carQrTarget('hello', origin)).toBeNull();
  });
});
