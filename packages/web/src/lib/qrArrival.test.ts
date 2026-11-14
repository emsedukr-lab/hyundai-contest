import { beforeEach, describe, expect, it } from 'vitest';
import { stashQrHash, takeQrHash } from './qrArrival';

describe('qrArrival', () => {
  beforeEach(() => {
    takeQrHash();
    history.replaceState(null, '', '/');
  });

  it('moves the QR fragment out of the address at once and hands it out once', () => {
    history.replaceState(null, '', '/c#v1.sid.secret.fp');
    stashQrHash();
    expect(location.hash).toBe('');
    expect(location.pathname).toBe('/c');
    expect(takeQrHash()).toBe('#v1.sid.secret.fp');
    expect(takeQrHash()).toBe('');
  });

  it('leaves fragments of other screens alone', () => {
    history.replaceState(null, '', '/trips/new#x');
    stashQrHash();
    expect(location.hash).toBe('#x');
    expect(takeQrHash()).toBe('');
  });
});
