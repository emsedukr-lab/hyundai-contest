/**
 * Regenerates schema/trip-transfer.v1.schema.json and the parity fixtures used by both TS and Kotlin tests.
 * Crypto vectors are created once (random keys) and then kept stable; pass --new-vectors to replace them.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  TripTransfer,
  b64url,
  buildTransfer,
  canonicalJson,
  contentHash,
  aadFor,
  deriveSessionKeys,
  encrypt,
  exportPublicRaw,
  fingerprint,
  generateKeyPair,
  sampleTrip,
  departure,
  timeline,
  dayEnd,
  dayIssues,
  sharedSecret,
  utf8,
  type Trip,
} from '../src/index';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../schema');
const write = (rel: string, data: unknown) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), JSON.stringify(data, null, 2) + '\n');
};

write('trip-transfer.v1.schema.json', z.toJSONSchema(TripTransfer, { target: 'draft-2020-12' }));

const EXPORTED = '2026-11-05T09:30:00+09:00';
const clone = <T>(v: T): T => structuredClone(v);
const expectations: Record<string, { valid: true } | { valid: false; code: string }> = {};

async function valid(name: string, trip: Trip) {
  write(`fixtures/valid/${name}.json`, await buildTransfer(trip, EXPORTED));
  expectations[`valid/${name}.json`] = { valid: true };
}

async function invalid(name: string, code: string, mutate: (trip: Trip) => void, opts: { rehash?: boolean; raw?: (t: Record<string, unknown>) => void } = {}) {
  const trip = clone(sampleTrip());
  mutate(trip);
  const transfer = (await buildTransfer(trip, EXPORTED)) as unknown as Record<string, unknown>;
  if (opts.rehash === false) transfer.contentHash = await contentHash(sampleTrip());
  opts.raw?.(transfer);
  write(`fixtures/invalid/${name}.json`, transfer);
  expectations[`invalid/${name}.json`] = { valid: false, code };
}

rmSync(join(root, 'fixtures/valid'), { recursive: true, force: true });
rmSync(join(root, 'fixtures/invalid'), { recursive: true, force: true });

await valid('sample', sampleTrip());

const unicode = clone(sampleTrip());
unicode.name = '강릉 "바다" 😀 여행';
unicode.places[0].address = 'tab\there \\ slash \u0007 bell   ls \ud83d end';
await valid('unicode', unicode);

const withHome = clone(sampleTrip());
withHome.home = { address: '서울특별시 중구 세종대로 110', latE7: 375_662_952, lonE7: 1_269_779_451 };
withHome.firstDay = { basis: 'ARRIVE_FIRST_STOP', arriveTime: '10:30', prepMinutes: 15 };
withHome.places[0].hours = { status: 'USER_ENTERED', weekly: [{ weekday: 5, open: '09:00', close: '21:00' }], closedDates: ['2026-11-21'] };
withHome.places[1].naviPoi = { poiId: '1234567', poiSubId: '0', poiProvider: 'HMG' };
await valid('with-home', withHome);

await valid('day-trip', {
  ...clone(sampleTrip()),
  tripId: '0b6f8a52-1d3e-4f6a-8b9c-2d4e6f8a0b1c',
  endDate: '2026-11-20',
  places: [sampleTrip().places[0]],
  visits: [{ ...sampleTrip().visits[0] }],
  days: [{ dayIndex: 1, date: '2026-11-20', departTime: null, endBy: '20:00', visitOrder: ['v1'], legs: [null, null], lodgingPlaceRef: null }],
});

const byName = clone(sampleTrip());
byName.places.push({ placeRef: 'mukho', name: '묵호 논골담길', address: '동해시 묵호진동', latE7: null, lonE7: null, category: 'SIGHT', source: { provider: 'MANUAL', externalId: null }, naviPoi: null, hours: { status: 'UNKNOWN' } });
byName.visits.push({ ...byName.visits[0], visitId: 'v12', placeRef: 'mukho', unassignedReason: 'NOT_SCHEDULED_YET', desiredTime: null });
await valid('place-without-coordinates', byName);

await invalid('half-coordinates', 'SCHEMA', (t) => (t.places[0].lonE7 = null));
await invalid('unknown-field', 'SCHEMA', () => {}, { raw: (t) => ((t.trip as Record<string, unknown>).memo = '예약번호 1234') });
await invalid('secret-field', 'SCHEMA', () => {}, { raw: (t) => ((t.trip as Record<string, unknown>).reservationPassword = 'x') });
await invalid('float-coordinate', 'SCHEMA', () => {}, {
  raw: (t) => (((t.trip as Trip).places[0] as { latE7: number }).latE7 = 378_920_000.5),
});
await invalid('bad-calendar-date', 'SCHEMA', (t) => (t.endDate = '2026-02-30'));
await invalid('bad-time', 'SCHEMA', (t) => (t.visits[4].fixed = { time: '24:00', kind: 'USER' }));
await invalid('bad-timezone', 'SCHEMA', (t) => (t.timezone = 'Asia/Nowhere'));
await invalid('unsupported-version', 'UNSUPPORTED_VERSION', () => {}, { raw: (t) => (t.schemaVersion = 2) });
await invalid('date-range', 'DATE_RANGE', (t) => (t.endDate = '2026-11-19'));
await invalid('day-count', 'DAY_COUNT_MISMATCH', (t) => (t.endDate = '2026-11-24'));
await invalid('day-sequence', 'DAY_SEQUENCE', (t) => (t.days[2].date = '2026-11-21'));
await invalid('duplicate-place', 'DUPLICATE_REF', (t) => t.places.push({ ...t.places[0] }));
await invalid('unknown-place', 'UNKNOWN_PLACE_REF', (t) => (t.days[0].lodgingPlaceRef = 'nowhere'));
await invalid('unknown-visit', 'UNKNOWN_VISIT_REF', (t) => {
  t.days[3].visitOrder.push('v99');
  t.days[3].legs.push(null);
});
await invalid('double-assignment', 'DUPLICATE_ASSIGNMENT', (t) => {
  t.days[3].visitOrder.push('v1');
  t.days[3].legs.push(null);
});
await invalid('legs-length', 'LEGS_LENGTH', (t) => t.days[1].legs.pop());
await invalid('unassigned-reason', 'UNASSIGNED_REASON_MISMATCH', (t) => (t.visits[0].unassignedReason = 'NO_TIME'));
await invalid('hash-mismatch', 'HASH_MISMATCH', (t) => (t.name = '바뀐 이름'), { rehash: false });

write('fixtures/expectations.json', expectations);

/* ---------- timetable parity (TS timeline.ts ↔ Kotlin TripValidator) ---------- */
rmSync(join(root, 'fixtures/timeline'), { recursive: true, force: true });
const timelineCases: Record<string, Trip> = {};
{
  const base = sampleTrip();
  timelineCases['sample'] = base;
  const late = clone(base); // day 4 leaves at 09:55: with the 10-min leg it arrives 10:05, after the 10:00 fixed visit
  late.days[3].departTime = '09:55';
  timelineCases['late-for-fixed'] = late;
  const arrive = clone(base); // arrival basis needs a start before midnight
  arrive.firstDay = { basis: 'ARRIVE_FIRST_STOP', arriveTime: '00:30', prepMinutes: 10 };
  arrive.days[0].legs[0] = { minutes: 90, source: 'USER_ESTIMATE' };
  timelineCases['depart-previous-day'] = arrive;
  const hours = clone(base); // user-entered hours: closed date, closed weekday, outside hours
  hours.places = hours.places.map((p) =>
    p.placeRef === 'lake' ? { ...p, hours: { status: 'USER_ENTERED', weekly: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, open: '10:00', close: '18:00' })), closedDates: [] } }
    : p.placeRef === 'mandong' ? { ...p, hours: { status: 'USER_ENTERED', weekly: [{ weekday: 1, open: '09:00', close: '21:00' }], closedDates: [] } }
    : p.placeRef === 'umji' ? { ...p, hours: { status: 'USER_ENTERED', weekly: [6].map((weekday) => ({ weekday, open: '17:00', close: '23:00' })), closedDates: ['2026-11-21'] } }
    : p) as Trip['places'];
  timelineCases['opening-hours'] = hours;
  const endBy = clone(base); // return-by time passed, and a day running past midnight
  endBy.days[1].endBy = '16:00';
  endBy.days[2].departTime = '22:30';
  timelineCases['end-by-and-midnight'] = endBy;
  const unknown = clone(base); // unknown legs before a fixed time
  unknown.days[1].legs = [null, null, { minutes: 15, source: 'USER_ESTIMATE' }, null, null];
  timelineCases['unknown-before-fixed'] = unknown;
}
const timelineExpect: Record<string, unknown> = {};
for (const [name, trip] of Object.entries(timelineCases)) {
  write(`fixtures/timeline/${name}.json`, await buildTransfer(trip, EXPORTED));
  timelineExpect[name] = trip.days.map((d) => ({
    dayIndex: d.dayIndex,
    departure: departure(trip, d.dayIndex),
    stops: timeline(trip, d.dayIndex),
    dayEnd: dayEnd(trip, d.dayIndex),
    issues: dayIssues(trip, d.dayIndex).map(({ severity, code, dayIndex, args }) => ({ severity, code, dayIndex, args })),
  }));
}
write('fixtures/timeline-expectations.json', timelineExpect);

/* ---------- crypto vectors (kept stable) ---------- */
const vectorsPath = join(root, 'fixtures/crypto/vectors.json');
if (!existsSync(vectorsPath) || process.argv.includes('--new-vectors')) {
  const car = await generateKeyPair(true);
  const mobile = await generateKeyPair(true);
  const carPub = await exportPublicRaw(car.publicKey);
  const mobilePub = await exportPublicRaw(mobile.publicKey);
  const sid = 'AAECAwQFBgcICQoLDA0ODw';
  const z1 = await sharedSecret(car.privateKey, mobile.publicKey);
  const keys = await deriveSessionKeys(z1, sid, carPub, mobilePub);
  const iv = new Uint8Array(12).map((_, i) => i + 1);
  const plaintext = canonicalJson(await buildTransfer(sampleTrip(), EXPORTED));
  const sealed = await encrypt(keys.key, utf8(plaintext), aadFor(sid, 1), iv);
  const jwk = async (k: CryptoKey) => {
    const j = await crypto.subtle.exportKey('jwk', k);
    return { d: j.d, x: j.x, y: j.y };
  };
  write('fixtures/crypto/vectors.json', {
    note: 'Fixed P-256 keys for cross-language tests only. Never used in production.',
    sid,
    car: { ...(await jwk(car.privateKey)), publicRaw: b64url(carPub), fingerprint: await fingerprint(carPub) },
    mobile: { ...(await jwk(mobile.privateKey)), publicRaw: b64url(mobilePub) },
    sharedSecret: b64url(z1),
    key: b64url(keys.key),
    confirmCode: keys.confirmCode,
    schemaVersion: 1,
    iv: sealed.iv,
    plaintextSha256: b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8(plaintext)))),
    plaintextFixture: 'valid/sample.json (canonical form)',
    ciphertext: sealed.ct,
  });
}
console.log(`schema + ${Object.keys(expectations).length} fixtures written to ${root}`);
