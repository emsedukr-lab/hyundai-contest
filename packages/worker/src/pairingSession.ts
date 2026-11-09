import { DurableObject } from 'cloudflare:workers';
import {
  DEFAULT_TTL,
  PROTOCOL,
  b64url,
  canonicalJson,
  fromB64url,
  importPublicRaw,
  isTerminal,
  randomBytes,
  randomId,
  transition,
  view,
  type ClaimRequest,
  type CreateSessionRequest,
  type PayloadBody,
  type ResultRequest,
  type Session,
  type SessionEvent,
  type Ttl,
} from '@tteonaljido/shared';
import { bearer, error, hashSecret, isB64url, json, matchesHash, readJson } from './http';
import type { Env } from './index';

const KEY = 'session';
const SMALL_BODY = 4096;

/**
 * One pairing session (one QR). A Durable Object processes one request at a time, which makes the
 * single-use claim and every state transition atomic. Stores ciphertext only, and only until the session ends.
 */
export class PairingSession extends DurableObject<Env> {
  private ttl: Ttl;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sec = (v: string | undefined, d: number) => (v ? Number(v) * 1000 : d);
    this.ttl = {
      qr: sec(env.TTL_QR, DEFAULT_TTL.qr),
      upload: sec(env.TTL_UPLOAD, DEFAULT_TTL.upload),
      result: sec(env.TTL_RESULT, DEFAULT_TTL.result),
      applyingExtension: sec(env.TTL_APPLYING, DEFAULT_TTL.applyingExtension),
      tombstone: sec(env.TTL_TOMBSTONE, DEFAULT_TTL.tombstone),
    };
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private load = () => this.ctx.storage.get<Session>(KEY);

  private async save(s: Session) {
    await this.ctx.storage.put(KEY, s);
    await this.ctx.storage.setAlarm(isTerminal(s.state) ? (s.purgeAt ?? Date.now()) : s.deadline);
  }

  private broadcast(s: Session) {
    const msg = JSON.stringify({ type: 'state', session: view(s, Date.now()) });
    for (const ws of this.ctx.getWebSockets('car')) {
      try {
        ws.send(msg);
      } catch {
        /* closed socket; the car re-reads the snapshot after reconnecting */
      }
    }
  }

  /** Applies an event; persists and notifies the car only when something changed. */
  private async apply(s: Session, e: SessionEvent) {
    const r = transition(s, e, Date.now(), this.ttl);
    if (!r.ok) {
      // An expiry discovered while handling a request must still be persisted.
      const expired = transition(s, { type: 'ALARM' }, Date.now(), this.ttl);
      if (expired.ok && expired.changed) {
        await this.save(expired.session);
        this.broadcast(expired.session);
        if (isTerminal(expired.session.state)) this.closeSockets();
      }
      return r;
    }
    if (r.changed) {
      await this.save(r.session);
      this.broadcast(r.session);
      // The final state is sent; the car need not hold the socket open for the whole tombstone window.
      if (isTerminal(r.session.state)) this.closeSockets();
    }
    return r;
  }

  private closeSockets() {
    for (const ws of this.ctx.getWebSockets('car')) {
      try {
        ws.close(1000, 'done');
      } catch {
        /* already closed */
      }
    }
  }

  override async alarm() {
    const s = await this.load();
    if (!s) return;
    if (isTerminal(s.state) && s.purgeAt !== null && Date.now() >= s.purgeAt) {
      for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'purged');
      await this.ctx.storage.deleteAll();
      return;
    }
    const r = transition(s, { type: 'ALARM' }, Date.now(), this.ttl);
    if (r.ok && r.changed) {
      await this.save(r.session);
      this.broadcast(r.session);
      if (isTerminal(r.session.state)) this.closeSockets(); // as in apply(): no socket held through the tombstone window
    } else {
      await this.ctx.storage.setAlarm(isTerminal(s.state) ? (s.purgeAt ?? Date.now()) : s.deadline);
    }
  }

  override async fetch(req: Request): Promise<Response> {
    const action = new URL(req.url).pathname.split('/').pop();
    if (action === 'create') return this.create(req);

    const s = await this.load();
    if (!s) return error('NOT_FOUND');
    const token = bearer(req);
    const isCar = await matchesHash(token, s.carTokenHash);
    const isMobile = !isCar && (await matchesHash(token, s.mobileTokenHash));

    switch (action) {
      case 'claim':
        return this.claim(req, s);
      case 'events':
        if (!isCar) return error('UNAUTHORIZED');
        return this.events(s);
      case 'snapshot':
        if (!isCar) return error('UNAUTHORIZED');
        return json(view(s, Date.now()));
      case 'status':
        if (!isMobile) return error('UNAUTHORIZED');
        return json(view(s, Date.now()));
      case 'payload':
        if (req.method === 'PUT') return isMobile ? this.upload(req, s) : error('UNAUTHORIZED');
        return isCar ? this.fetchPayload(s) : error('UNAUTHORIZED');
      case 'lock':
        if (!isCar) return error('UNAUTHORIZED');
        return this.respond(await this.apply(s, { type: 'LOCK' }));
      case 'result':
        return isCar ? this.result(req, s) : error('UNAUTHORIZED');
      case 'cancel':
        if (!isCar && !isMobile) return error('UNAUTHORIZED');
        return this.respond(await this.apply(s, { type: 'CANCEL', by: isCar ? 'CAR' : 'MOBILE' }));
      default:
        return error('NOT_FOUND');
    }
  }

  private respond(r: Awaited<ReturnType<PairingSession['apply']>>) {
    return r.ok ? json(view(r.session, Date.now())) : error(r.error);
  }

  private async create(req: Request) {
    if (await this.load()) return error('INVALID_STATE');
    const body = await readJson<CreateSessionRequest & { sid: string }>(req, SMALL_BODY);
    if (body === 'TOO_LARGE') return error('PAYLOAD_TOO_LARGE');
    if (!body || !isB64url(body.carPub, 87, 87) || typeof body.appVersion !== 'string' || body.appVersion.length > 20) return error('BAD_REQUEST');
    const versions = Array.isArray(body.supportedSchemaVersions) ? body.supportedSchemaVersions.filter((v) => Number.isInteger(v)).slice(0, 8) : [];
    if (!versions.length) return error('BAD_REQUEST');
    try {
      await importPublicRaw(fromB64url(body.carPub));
    } catch {
      return error('BAD_REQUEST');
    }
    const now = Date.now();
    const scanSecret = randomId();
    const carToken = b64url(randomBytes(32));
    const s: Session = {
      sid: body.sid,
      state: 'CREATED',
      createdAt: now,
      qrExpiresAt: now + this.ttl.qr,
      deadline: now + this.ttl.qr,
      purgeAt: null,
      carTokenHash: await hashSecret(carToken),
      scanSecretHash: await hashSecret(scanSecret),
      claimAttempts: 0,
      carPub: body.carPub,
      carAppVersion: body.appVersion,
      supportedSchemaVersions: versions,
      mobilePub: null,
      mobileTokenHash: null,
      payload: null,
      uploadedBodyHash: null,
      carFetchedAt: null,
      outcome: null,
      resultCode: null,
      appliedRevision: null,
      cancelReason: null,
      expireReason: null,
    };
    await this.save(s);
    return json({ sid: s.sid, scanSecret, carToken, qrExpiresAt: s.qrExpiresAt, serverTime: now }, 201);
  }

  private async claim(req: Request, s: Session) {
    const body = await readJson<ClaimRequest>(req, SMALL_BODY);
    if (body === 'TOO_LARGE') return error('PAYLOAD_TOO_LARGE');
    if (!body || !isB64url(body.scanSecret, 22, 22) || !isB64url(body.mobilePub, 87, 87)) return error('BAD_REQUEST');
    // CREATED is the first claim; CLAIMED lets the same phone retry after a lost response. Anything else is a bad attempt.
    if (s.state !== 'CREATED' && s.state !== 'CLAIMED') return this.respond(await this.apply(s, { type: 'CLAIM_BAD' }));
    if (!(await matchesHash(body.scanSecret, s.scanSecretHash))) {
      const r = await this.apply(s, { type: 'CLAIM_BAD' });
      return r.ok ? error('UNAUTHORIZED') : error(r.error);
    }
    try {
      await importPublicRaw(fromB64url(body.mobilePub));
    } catch {
      return error('BAD_REQUEST');
    }
    const mobileToken = b64url(randomBytes(32));
    const r = await this.apply(s, { type: 'CLAIM_OK', mobilePub: body.mobilePub, mobileTokenHash: await hashSecret(mobileToken) });
    if (!r.ok) return error(r.error);
    return json({
      mobileToken,
      carPub: s.carPub,
      supportedSchemaVersions: s.supportedSchemaVersions,
      carAppVersion: s.carAppVersion,
      uploadDeadline: r.session.deadline,
      serverTime: Date.now(),
    });
  }

  private async upload(req: Request, s: Session) {
    const body = await readJson<PayloadBody>(req, PROTOCOL.limits.maxPayloadBytes + 512);
    if (body === 'TOO_LARGE') return error('PAYLOAD_TOO_LARGE');
    if (!body || !isB64url(body.iv, 16, 16) || !isB64url(body.ct, 22, PROTOCOL.limits.maxPayloadBytes) || !Number.isSafeInteger(body.schemaVersion)) {
      return error('BAD_REQUEST');
    }
    const envelope = { iv: body.iv, ct: body.ct, schemaVersion: body.schemaVersion };
    const bodyHash = await hashSecret(canonicalJson(envelope));
    return this.respond(await this.apply(s, { type: 'UPLOAD', payload: { ...envelope, bodyHash } }));
  }

  private async fetchPayload(s: Session) {
    const r = await this.apply(s, { type: 'FETCH' });
    if (!r.ok) return error(r.error);
    const p = r.session.payload!;
    return json({ iv: p.iv, ct: p.ct, schemaVersion: p.schemaVersion, mobilePub: r.session.mobilePub });
  }

  private async result(req: Request, s: Session) {
    const body = await readJson<ResultRequest>(req, SMALL_BODY);
    if (body === 'TOO_LARGE') return error('PAYLOAD_TOO_LARGE');
    const codes = PROTOCOL.resultCodes as readonly string[];
    if (!body || (body.outcome !== 'APPLIED' && body.outcome !== 'REJECTED') || !codes.includes(body.resultCode)) return error('BAD_REQUEST');
    const rev = body.appliedRevision === null || Number.isInteger(body.appliedRevision) ? body.appliedRevision : null;
    return this.respond(await this.apply(s, { type: 'RESULT', outcome: body.outcome, resultCode: body.resultCode, appliedRevision: rev }));
  }

  private events(s: Session) {
    // One car socket per session: a reconnect replaces the previous one.
    for (const old of this.ctx.getWebSockets('car')) old.close(4000, 'replaced');
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], ['car']);
    pair[1].send(JSON.stringify({ type: 'state', session: view(s, Date.now()) }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override async webSocketMessage() {
    /* the car never sends anything but ping (auto-answered) */
  }

  override async webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code === 1005 ? 1000 : code, 'bye');
    } catch {
      /* already closed */
    }
  }
}
