import protocol from '../../../schema/pairing-protocol.v1.json' with { type: 'json' };

/** One-time pairing session protocol (spec 24-2, 24-6). The Durable Object applies `transition`; clients only read. */
export const PROTOCOL = protocol;

export type SessionState = (typeof protocol.states)[number];
export type ResultCode = (typeof protocol.resultCodes)[number];
export type CancelReason = (typeof protocol.cancelReasons)[number];
export type ExpireReason = (typeof protocol.expireReasons)[number];
export type ErrorCode = keyof typeof protocol.errors;

export const isTerminal = (s: SessionState) => (protocol.terminalStates as readonly string[]).includes(s);

export interface StoredPayload {
  iv: string;
  ct: string;
  schemaVersion: number;
  bodyHash: string;
}

export interface Session {
  sid: string;
  state: SessionState;
  createdAt: number;
  qrExpiresAt: number;
  deadline: number;
  purgeAt: number | null;
  carTokenHash: string;
  scanSecretHash: string;
  claimAttempts: number;
  carPub: string;
  carAppVersion: string;
  supportedSchemaVersions: number[];
  mobilePub: string | null;
  mobileTokenHash: string | null;
  payload: StoredPayload | null;
  carFetchedAt: number | null;
  outcome: 'APPLIED' | 'REJECTED' | null;
  resultCode: ResultCode | null;
  appliedRevision: number | null;
  cancelReason: CancelReason | null;
  expireReason: ExpireReason | null;
}

export type SessionEvent =
  | { type: 'CLAIM_OK'; mobilePub: string; mobileTokenHash: string }
  | { type: 'CLAIM_BAD' }
  | { type: 'UPLOAD'; payload: StoredPayload }
  | { type: 'FETCH' }
  | { type: 'LOCK' }
  | { type: 'RESULT'; outcome: 'APPLIED' | 'REJECTED'; resultCode: ResultCode; appliedRevision: number | null }
  | { type: 'CANCEL'; by: CancelReason }
  | { type: 'ALARM' };

export type Transition = { ok: true; session: Session; changed: boolean } | { ok: false; error: ErrorCode };

const ttl = (k: keyof typeof protocol.ttlSeconds) => protocol.ttlSeconds[k] * 1000;

export interface Ttl {
  qr: number;
  upload: number;
  result: number;
  applyingExtension: number;
  tombstone: number;
}

export const DEFAULT_TTL: Ttl = {
  qr: ttl('qr'),
  upload: ttl('upload'),
  result: ttl('result'),
  applyingExtension: ttl('applyingExtension'),
  tombstone: ttl('tombstone'),
};

function finish(s: Session, now: number, t: Ttl, patch: Partial<Session>): Session {
  // Terminal: payload and secrets are dropped at once; only a tombstone (state, outcome, times) remains.
  return { ...s, ...patch, payload: null, scanSecretHash: '', deadline: now, purgeAt: now + t.tombstone };
}

const ok = (session: Session, changed = true): Transition => ({ ok: true, session, changed });
const fail = (error: ErrorCode): Transition => ({ ok: false, error });

export function transition(s: Session, e: SessionEvent, now: number, t: Ttl = DEFAULT_TTL): Transition {
  if (e.type !== 'ALARM' && !isTerminal(s.state) && now >= s.deadline) {
    const expired = transition(s, { type: 'ALARM' }, now, t);
    if (expired.ok && expired.changed) return transition(expired.session, e, now, t);
  }
  switch (e.type) {
    case 'ALARM': {
      if (isTerminal(s.state) || now < s.deadline) return ok(s, false);
      const reason: ExpireReason =
        s.state === 'CREATED' ? 'QR' : s.state === 'CLAIMED' ? 'UPLOAD' : s.state === 'MOBILE_APPROVED' ? 'RESULT' : 'UNCONFIRMED';
      return ok(finish(s, now, t, { state: 'EXPIRED', expireReason: reason }));
    }
    case 'CLAIM_OK':
      if (s.state === 'EXPIRED') return fail('EXPIRED');
      if (s.state !== 'CREATED') return fail('ALREADY_CLAIMED');
      return ok({ ...s, state: 'CLAIMED', scanSecretHash: '', mobilePub: e.mobilePub, mobileTokenHash: e.mobileTokenHash, deadline: now + t.upload });
    case 'CLAIM_BAD': {
      if (s.state === 'EXPIRED') return fail('EXPIRED');
      if (s.state !== 'CREATED') return fail('ALREADY_CLAIMED');
      const attempts = s.claimAttempts + 1;
      if (attempts >= protocol.limits.maxClaimAttempts) return ok(finish(s, now, t, { state: 'CANCELLED', cancelReason: 'SECURITY', claimAttempts: attempts }));
      return ok({ ...s, claimAttempts: attempts });
    }
    case 'UPLOAD':
      if (s.state === 'EXPIRED') return fail('EXPIRED');
      if (s.state === 'MOBILE_APPROVED' || s.state === 'CAR_APPLYING') {
        return s.payload?.bodyHash === e.payload.bodyHash ? ok(s, false) : fail('PAYLOAD_CONFLICT');
      }
      if (s.state !== 'CLAIMED') return fail('INVALID_STATE');
      if (!s.supportedSchemaVersions.includes(e.payload.schemaVersion)) return fail('UNSUPPORTED_VERSION');
      return ok({ ...s, state: 'MOBILE_APPROVED', payload: e.payload, deadline: now + t.result });
    case 'FETCH':
      if (s.state === 'EXPIRED') return fail('EXPIRED');
      if ((s.state !== 'MOBILE_APPROVED' && s.state !== 'CAR_APPLYING') || !s.payload) return fail('INVALID_STATE');
      return ok({ ...s, carFetchedAt: s.carFetchedAt ?? now }, s.carFetchedAt === null);
    case 'LOCK':
      if (s.state === 'EXPIRED') return fail('EXPIRED');
      if (s.state === 'CAR_APPLYING') return ok(s, false);
      if (s.state !== 'MOBILE_APPROVED') return fail('INVALID_STATE');
      return ok({ ...s, state: 'CAR_APPLYING', deadline: s.deadline + t.applyingExtension });
    case 'RESULT': {
      const patch = { outcome: e.outcome, resultCode: e.resultCode, appliedRevision: e.appliedRevision };
      if (s.state === 'APPLIED' || s.state === 'REJECTED') {
        return s.outcome === e.outcome && s.resultCode === e.resultCode ? ok(s, false) : fail('INVALID_STATE');
      }
      // A late APPLIED report upgrades an UNCONFIRMED expiry so the phone learns the truth.
      if (s.state === 'EXPIRED' && s.expireReason === 'UNCONFIRMED' && e.outcome === 'APPLIED') return ok({ ...s, state: 'APPLIED', ...patch });
      if (s.state === 'EXPIRED') return fail('EXPIRED');
      if (e.outcome === 'APPLIED' && s.state !== 'CAR_APPLYING') return fail('INVALID_STATE');
      if (e.outcome === 'REJECTED' && s.state !== 'CAR_APPLYING' && s.state !== 'MOBILE_APPROVED') return fail('INVALID_STATE');
      return ok(finish(s, now, t, { state: e.outcome, ...patch }));
    }
    case 'CANCEL':
      if (isTerminal(s.state)) return s.state === 'CANCELLED' ? ok(s, false) : fail(s.state === 'EXPIRED' ? 'EXPIRED' : 'INVALID_STATE');
      if (s.state === 'CAR_APPLYING' && e.by === 'MOBILE') return fail('APPLYING');
      return ok(finish(s, now, t, { state: 'CANCELLED', cancelReason: e.by }));
  }
}

/** What either client may see. Secrets, token hashes and the payload never leave the Durable Object. */
export interface SessionView {
  sid: string;
  state: SessionState;
  serverTime: number;
  qrExpiresAt: number;
  deadline: number;
  claimed: boolean;
  carFetched: boolean;
  outcome: 'APPLIED' | 'REJECTED' | null;
  resultCode: ResultCode | null;
  appliedRevision: number | null;
  cancelReason: CancelReason | null;
  expireReason: ExpireReason | null;
  mobilePub: string | null;
  supportedSchemaVersions: number[];
  carAppVersion: string;
}

export function view(s: Session, now: number): SessionView {
  return {
    sid: s.sid,
    state: s.state,
    serverTime: now,
    qrExpiresAt: s.qrExpiresAt,
    deadline: s.deadline,
    claimed: s.mobilePub !== null,
    carFetched: s.carFetchedAt !== null,
    outcome: s.outcome,
    resultCode: s.resultCode,
    appliedRevision: s.appliedRevision,
    cancelReason: s.cancelReason,
    expireReason: s.expireReason,
    mobilePub: s.mobilePub,
    supportedSchemaVersions: s.supportedSchemaVersions,
    carAppVersion: s.carAppVersion,
  };
}

/* ---------- QR link: https://<host>/c#v1.<sid>.<scanSecret>.<fp> ---------- */

export interface QrLink {
  sid: string;
  scanSecret: string;
  fingerprint: string;
}

const ID22 = /^[A-Za-z0-9_-]{22}$/;

export function formatQrUrl(origin: string, link: QrLink): string {
  return `${origin.replace(/\/$/, '')}${protocol.qr.path}#${protocol.qr.fragmentVersion}.${link.sid}.${link.scanSecret}.${link.fingerprint}`;
}

export function parseQrFragment(hash: string): QrLink | null {
  const parts = hash.replace(/^#/, '').split('.');
  if (parts.length !== 4 || parts[0] !== protocol.qr.fragmentVersion) return null;
  const [, sid, scanSecret, fp] = parts;
  if (![sid, scanSecret, fp].every((p) => ID22.test(p))) return null;
  return { sid, scanSecret, fingerprint: fp };
}

/* ---------- API bodies ---------- */

export interface CreateSessionRequest {
  carPub: string;
  appVersion: string;
  supportedSchemaVersions: number[];
}
export interface CreateSessionResponse {
  sid: string;
  scanSecret: string;
  carToken: string;
  qrExpiresAt: number;
  serverTime: number;
}
export interface ClaimRequest {
  scanSecret: string;
  mobilePub: string;
}
export interface ClaimResponse {
  mobileToken: string;
  carPub: string;
  supportedSchemaVersions: number[];
  carAppVersion: string;
  uploadDeadline: number;
  serverTime: number;
}
export interface PayloadBody {
  iv: string;
  ct: string;
  schemaVersion: number;
}
export interface ResultRequest {
  outcome: 'APPLIED' | 'REJECTED';
  resultCode: ResultCode;
  appliedRevision: number | null;
}
export interface ApiError {
  error: ErrorCode;
}
