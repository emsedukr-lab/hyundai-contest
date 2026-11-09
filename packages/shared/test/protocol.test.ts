import { describe, expect, it } from 'vitest';
import { DEFAULT_TTL as T, formatQrUrl, parseQrFragment, transition, type Session, type SessionEvent } from '../src/protocol';

const base = (over: Partial<Session> = {}): Session => ({
  sid: 'sid',
  state: 'CREATED',
  createdAt: 0,
  qrExpiresAt: T.qr,
  deadline: T.qr,
  purgeAt: null,
  uploadedBodyHash: null,
  carTokenHash: 'c',
  scanSecretHash: 's',
  claimAttempts: 0,
  carPub: 'pub',
  carAppVersion: '0.1.0',
  supportedSchemaVersions: [1],
  mobilePub: null,
  mobileTokenHash: null,
  payload: null,
  carFetchedAt: null,
  outcome: null,
  resultCode: null,
  appliedRevision: null,
  cancelReason: null,
  expireReason: null,
  ...over,
});

const payload = { iv: 'iv', ct: 'ct', schemaVersion: 1, bodyHash: 'h1' };
const run = (s: Session, now: number, ...events: SessionEvent[]) =>
  events.reduce<Session>((cur, e) => {
    const r = transition(cur, e, now);
    if (!r.ok) throw new Error(r.error);
    return r.session;
  }, s);

describe('pairing session transitions', () => {
  it('happy path ends APPLIED and drops the payload and secrets', () => {
    const s = run(
      base(),
      1000,
      { type: 'CLAIM_OK', mobilePub: 'm', mobileTokenHash: 't' },
      { type: 'UPLOAD', payload },
      { type: 'FETCH' },
      { type: 'LOCK' },
      { type: 'RESULT', outcome: 'APPLIED', resultCode: 'IMPORTED_NEW', appliedRevision: 1 },
    );
    expect(s).toMatchObject({ state: 'APPLIED', payload: null, scanSecretHash: '', purgeAt: 1000 + T.tombstone, carFetchedAt: 1000 });
  });

  it('a second claim is refused (QR is single use)', () => {
    const s = run(base(), 10, { type: 'CLAIM_OK', mobilePub: 'm', mobileTokenHash: 't' });
    expect(transition(s, { type: 'CLAIM_OK', mobilePub: 'x', mobileTokenHash: 'y' }, 20)).toEqual({ ok: false, error: 'ALREADY_CLAIMED' });
  });

  it('claim after QR expiry returns EXPIRED', () => {
    expect(transition(base(), { type: 'CLAIM_OK', mobilePub: 'm', mobileTokenHash: 't' }, T.qr)).toEqual({ ok: false, error: 'EXPIRED' });
  });

  it('five wrong secrets cancel the session for security', () => {
    let s = base();
    for (let i = 0; i < 4; i++) s = run(s, 10, { type: 'CLAIM_BAD' });
    expect(s.state).toBe('CREATED');
    s = run(s, 10, { type: 'CLAIM_BAD' });
    expect(s).toMatchObject({ state: 'CANCELLED', cancelReason: 'SECURITY' });
  });

  it('identical re-upload is idempotent; a different body conflicts', () => {
    const s = run(base(), 10, { type: 'CLAIM_OK', mobilePub: 'm', mobileTokenHash: 't' }, { type: 'UPLOAD', payload });
    expect(transition(s, { type: 'UPLOAD', payload }, 20)).toMatchObject({ ok: true, changed: false });
    expect(transition(s, { type: 'UPLOAD', payload: { ...payload, bodyHash: 'h2' } }, 20)).toEqual({ ok: false, error: 'PAYLOAD_CONFLICT' });
  });

  it('refuses an unsupported schema version', () => {
    const s = run(base(), 10, { type: 'CLAIM_OK', mobilePub: 'm', mobileTokenHash: 't' });
    expect(transition(s, { type: 'UPLOAD', payload: { ...payload, schemaVersion: 2 } }, 20)).toEqual({ ok: false, error: 'UNSUPPORTED_VERSION' });
  });

  it('phone cannot cancel once the car is applying', () => {
    const s = run(base(), 10, { type: 'CLAIM_OK', mobilePub: 'm', mobileTokenHash: 't' }, { type: 'UPLOAD', payload }, { type: 'LOCK' });
    expect(transition(s, { type: 'CANCEL', by: 'MOBILE' }, 20)).toEqual({ ok: false, error: 'APPLYING' });
    expect(run(s, 20, { type: 'CANCEL', by: 'CAR' }).state).toBe('CANCELLED');
  });

  it('expires in every phase with the right reason', () => {
    expect(run(base(), T.qr, { type: 'ALARM' }).expireReason).toBe('QR');
    const claimed = run(base(), 10, { type: 'CLAIM_OK', mobilePub: 'm', mobileTokenHash: 't' });
    expect(run(claimed, 10 + T.upload, { type: 'ALARM' }).expireReason).toBe('UPLOAD');
    const approved = run(claimed, 20, { type: 'UPLOAD', payload });
    expect(run(approved, 20 + T.result, { type: 'ALARM' })).toMatchObject({ expireReason: 'RESULT', payload: null });
    const applying = run(approved, 30, { type: 'LOCK' });
    expect(run(applying, 20 + T.result + T.applyingExtension, { type: 'ALARM' }).expireReason).toBe('UNCONFIRMED');
  });

  it('a late APPLIED report upgrades UNCONFIRMED so the phone learns the truth', () => {
    const applying = run(base(), 10, { type: 'CLAIM_OK', mobilePub: 'm', mobileTokenHash: 't' }, { type: 'UPLOAD', payload }, { type: 'LOCK' });
    const late = 10 + T.result + T.applyingExtension + 5;
    const s = run(applying, late, { type: 'RESULT', outcome: 'APPLIED', resultCode: 'UPDATED', appliedRevision: 3 });
    expect(s).toMatchObject({ state: 'APPLIED', resultCode: 'UPDATED' });
  });

  it('repeated identical result is harmless', () => {
    const s = run(base(), 10, { type: 'CLAIM_OK', mobilePub: 'm', mobileTokenHash: 't' }, { type: 'UPLOAD', payload }, { type: 'RESULT', outcome: 'REJECTED', resultCode: 'USER_DECLINED', appliedRevision: null });
    expect(transition(s, { type: 'RESULT', outcome: 'REJECTED', resultCode: 'USER_DECLINED', appliedRevision: null }, 20)).toMatchObject({ ok: true, changed: false });
  });

  it('APPLIED requires the commit lock', () => {
    const s = run(base(), 10, { type: 'CLAIM_OK', mobilePub: 'm', mobileTokenHash: 't' }, { type: 'UPLOAD', payload });
    expect(transition(s, { type: 'RESULT', outcome: 'APPLIED', resultCode: 'IMPORTED_NEW', appliedRevision: 1 }, 20)).toEqual({ ok: false, error: 'INVALID_STATE' });
  });
});

describe('QR link', () => {
  const link = { sid: 'AAECAwQFBgcICQoLDA0ODw', scanSecret: 'EBESExQVFhcYGRobHB0eHw', fingerprint: 'ICEiIyQlJicoKSorLC0uLw' };
  it('keeps secrets in the fragment and round-trips', () => {
    const url = formatQrUrl('https://example.test/', link);
    expect(url).toBe('https://example.test/c#v1.AAECAwQFBgcICQoLDA0ODw.EBESExQVFhcYGRobHB0eHw.ICEiIyQlJicoKSorLC0uLw');
    expect(new URL(url).search).toBe('');
    expect(parseQrFragment(new URL(url).hash)).toEqual(link);
  });
  it('rejects malformed fragments', () => {
    expect(parseQrFragment('#v2.a.b.c')).toBeNull();
    expect(parseQrFragment('#v1.short.EBESExQVFhcYGRobHB0eHw.ICEiIyQlJicoKSorLC0uLw')).toBeNull();
  });
});
