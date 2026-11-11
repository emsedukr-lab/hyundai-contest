/**
 * Pleos Fleet API webhook (주기 데이터 · 차량 이벤트), receiving side: check the documented envelope, keep the newest value
 * of each documented field per vehicle, and turn that into a pre-departure readiness answer for a planned distance.
 * Pure — the Worker owns transport and storage. Field paths, enums and error codes are the ones printed in the Fleet API
 * docs and nothing else is read. Fleet API access needs a Pleos Fleet contract, so this is proven with the docs' own
 * payload examples (fleetSamples.ts), never against the live service.
 */

const NUM = 'number';
// Enums list first the value a boolean `true` stands for: the docs' event example sends `false` where their schema
// table says "BUCKLE"/"UNBUCKLE", so a boolean is read as "the state the field is named after holds".
const ON_OFF = ['ON', 'OFF'] as const;
const OPEN = ['OPEN', 'CLOSE'] as const;
const BUCKLE = ['BUCKLE', 'UNBUCKLE'] as const;
const LAMP = ['ON', 'OFF', 'BLINK'] as const;
const LOW = ['LOW', 'NORMAL'] as const;

/**
 * Everything kept per vehicle, keyed by its documented path. Deliberately absent: `vin`, `Vehicle.Latitude` and
 * `Vehicle.Longitude` — readiness needs neither the identity nor the position, so they are never copied out of a request.
 */
export const FLEET_FIELDS = {
  'TractionBattery.SOC': NUM, // %
  'Vehicle.DTE': NUM, // km
  'Vehicle.Odometer': NUM, // km
  'Vehicle.Speed': NUM, // km/h
  'AuxiliaryBattery.Voltage': NUM, // V
  'Vehicle.Tire.Pressure.FrontLeft': NUM, // the docs give no unit
  'Vehicle.Tire.Pressure.FrontRight': NUM,
  'Vehicle.Tire.Pressure.RearLeft': NUM,
  'Vehicle.Tire.Pressure.RearRight': NUM,
  'ChargeSystem.Active': ['ACTIVE', 'INACTIVE'],
  'ChargePort.Plug': ['PLUG', 'UNPLUG'],
  'Vehicle.DrivingReady': ON_OFF,
  'Vehicle.Ignition1': ON_OFF,
  'Door.Open.Driver': OPEN,
  'Door.Lock.Driver': ['LOCK', 'UNLOCK'],
  'Hood.Open': OPEN,
  'Trunk.Open': OPEN,
  'ParkingBrake.Engage': ['ENGAGE', 'DISENGAGE'],
  'Seat.Buckle.Driver': BUCKLE,
  'Seat.Buckle.Passenger': BUCKLE,
  'Emergency.Crash': ['CRASH', 'UNCRASH'],
  'WarningLamp.Airbag': LAMP,
  'WarningLamp.EBD': LAMP,
  'WarningLamp.ABS': LAMP,
  'WarningLamp.EPS': LAMP,
  'WarningLamp.ChargingSystem': LAMP,
  'WarningLamp.TirePressure.FrontLeft': LOW,
  'WarningLamp.TirePressure.FrontRight': LOW,
  'WarningLamp.TirePressure.RearLeft': LOW,
  'WarningLamp.TirePressure.RearRight': LOW,
  'WarningLamp.HeadLamp': ['DEFECT', 'NORMAL'],
  'WarningLamp.EPB': LAMP,
  'WarningLamp.ESC': LAMP,
  'WarningLamp.RegenerativeBrake': LAMP,
  'WarningLamp.TractionBatterySOC': LAMP,
  'WarningLamp.EVPowerDown': LAMP,
  'WarningLamp.EVService': LAMP,
  'WarningLamp.WasherFluid': LOW,
  'WarningLamp.BrakeOil': LOW,
  'WarningLamp.AuxiliaryBatterySOC': LOW,
} as const;

export type FleetField = keyof typeof FLEET_FIELDS;
type Kind<K extends FleetField> = (typeof FLEET_FIELDS)[K];
export type FleetValue<K extends FleetField> = Kind<K> extends readonly string[] ? Kind<K>[number] : number;

/** A documented ValueObject after reading: `eventTime` in epoch milliseconds. */
export interface FleetReading<T> {
  value: T;
  eventTime: number;
}

export type FleetValues = { [K in FleetField]?: FleetReading<FleetValue<K>> };

export interface FleetVehicleState {
  vehicleId: string;
  /** Newest event time among the kept readings (ms). A webhook that only repeats old values does not make it look fresh. */
  updatedAt: number;
  values: FleetValues;
}

/* ---------- envelope ---------- */

export type FleetErrorCode = 'ERR_MISSING_FIELD' | 'ERR_INVALID_VALUE';

/** One entry of `errors[]` in the documented 400 callback response. */
export interface FleetFieldError {
  field: string;
  message: string;
  code: FleetErrorCode;
}

export interface FleetItem {
  /** `messageTime`, epoch milliseconds. */
  messageTime: number;
  data: Record<string, unknown>;
}

/** A checked request. `vin` is validated but not carried on: nothing downstream may hold it. */
export interface FleetWebhookPayload {
  vehicleId: string;
  items: FleetItem[];
}

export type FleetParse = { ok: true; payload: FleetWebhookPayload } | { ok: false; errors: FleetFieldError[] };

/** A periodic webhook carries a handful of samples per transmission; far above that is not a real request. */
export const FLEET_MAX_ITEMS = 500;
/** The docs' sample is a UUID. Kept this narrow because the id names the stored record and appears in a path. */
export const FLEET_VEHICLE_ID = /^[A-Za-z0-9-]{1,64}$/;
const MAX_ERRORS = 20; // enough to fix a request; a 500-item body must not echo 1000 lines back

const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)$/;

/**
 * ISO 8601 date-time to epoch ms, or null. Parsed by hand because the docs print nine fraction digits
 * ("2025-02-12T08:12:58.628000000Z"), which `Date.parse` is not required to accept, and because a time without a zone
 * would be read differently on every host.
 */
export function parseFleetTime(v: unknown): number | null {
  const m = typeof v === 'string' ? ISO.exec(v) : null;
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  const ms = Number((m[7] ?? '').slice(0, 3).padEnd(3, '0'));
  const t = Date.UTC(y, mo - 1, d, h, mi, s, ms);
  const back = new Date(t);
  // Date.UTC rolls 02-30 or 24:00 over into the next day instead of refusing them.
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d || h > 23 || mi > 59 || s > 59) return null;
  if (m[8] === 'Z') return t;
  const offsetMin = Number(m[8].slice(1, 3)) * 60 + Number(m[8].slice(-2));
  return t - (m[8][0] === '-' ? -offsetMin : offsetMin) * 60_000;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Checks the documented envelope only (vin, vehicleId, itemsCount, items[].messageTime, items[].data). The vehicle
 * fields inside `data` are all optional in the docs, so an unknown or odd one is skipped by the reducer, not refused:
 * a 400 would make Fleet resend a request that can never pass. `itemsCount` is not compared with `items.length` —
 * the docs' own event example says 3 and carries one.
 */
export function parseFleetWebhook(body: unknown): FleetParse {
  const errors: FleetFieldError[] = [];
  const missing = (field: string) => errors.push({ field, message: 'This field is required.', code: 'ERR_MISSING_FIELD' });
  const invalid = (field: string, message: string) => errors.push({ field, message, code: 'ERR_INVALID_VALUE' });
  const b = isObject(body) ? body : {};

  if (b.vin == null) missing('vin');
  else if (typeof b.vin !== 'string' || !b.vin) invalid('vin', 'The value must be a non-empty string.');

  if (b.vehicleId == null) missing('vehicleId');
  else if (typeof b.vehicleId !== 'string' || !FLEET_VEHICLE_ID.test(b.vehicleId)) invalid('vehicleId', 'The value must be 1 to 64 letters, digits or hyphens.');

  if (b.itemsCount != null && !(Number.isInteger(b.itemsCount) && (b.itemsCount as number) >= 0)) invalid('itemsCount', 'The value must be a non-negative integer.');

  const items: FleetItem[] = [];
  if (b.items == null) missing('items');
  else if (!Array.isArray(b.items)) invalid('items', 'The value must be an array.');
  else if (b.items.length > FLEET_MAX_ITEMS) invalid('items', `The value must hold at most ${FLEET_MAX_ITEMS} items.`);
  else {
    b.items.forEach((raw: unknown, i: number) => {
      if (!isObject(raw)) return invalid(`items[${i}]`, 'The value must be an object.');
      const time = parseFleetTime(raw.messageTime);
      if (raw.messageTime == null) missing(`items[${i}].messageTime`);
      else if (time === null) invalid(`items[${i}].messageTime`, 'The value must be an ISO 8601 date-time with a time zone.');
      if (raw.data == null) missing(`items[${i}].data`);
      else if (!isObject(raw.data)) invalid(`items[${i}].data`, 'The value must be an object.');
      if (time !== null && isObject(raw.data)) items.push({ messageTime: time, data: raw.data });
    });
  }

  if (errors.length) return { ok: false, errors: errors.slice(0, MAX_ERRORS) };
  return { ok: true, payload: { vehicleId: b.vehicleId as string, items } };
}

/* ---------- state ---------- */

function at(data: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = data;
  for (const key of path) {
    if (!isObject(cur) || !Object.hasOwn(cur, key)) return undefined;
    cur = cur[key];
  }
  return cur;
}

/**
 * The docs' schema table and their examples disagree about the leading `Vehicle.` segment (table: `Vehicle.Tire.Pressure`
 * and `Seat.Buckle`; examples: `Tire.Pressure` and `Vehicle.Seat.Buckle`), so the documented path is read first and the
 * other spelling second.
 */
function lookup(data: Record<string, unknown>, field: string): unknown {
  const path = field.split('.');
  return at(data, path) ?? at(data, path[0] === 'Vehicle' ? path.slice(1) : ['Vehicle', ...path]);
}

function normalise(kind: typeof NUM | readonly string[], raw: unknown): number | string | undefined {
  if (kind === NUM) return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === 'boolean') return kind[raw ? 0 : 1];
  if (typeof raw !== 'string') return undefined;
  const s = raw.toUpperCase();
  return kind.includes(s) ? s : undefined;
}

/**
 * Folds a request into the vehicle's state. Per field the newest reading wins, by its `eventTime` and, when that is
 * absent or unreadable, by the item's `messageTime` — so a late or repeated delivery never overwrites newer data.
 */
export function reduceFleet(prev: FleetVehicleState | undefined, payload: FleetWebhookPayload): FleetVehicleState {
  const values: Record<string, FleetReading<number | string>> = { ...(prev?.vehicleId === payload.vehicleId ? prev.values : {}) };
  for (const item of payload.items) {
    for (const [field, kind] of Object.entries(FLEET_FIELDS)) {
      const reading = lookup(item.data, field);
      if (!isObject(reading)) continue;
      const value = normalise(kind, reading.value);
      if (value === undefined) continue;
      const eventTime = parseFleetTime(reading.eventTime) ?? item.messageTime;
      if (!values[field] || eventTime > values[field].eventTime) values[field] = { value, eventTime };
    }
  }
  const updatedAt = Math.max(0, ...Object.values(values).map((r) => r.eventTime));
  return { vehicleId: payload.vehicleId, updatedAt, values: values as FleetValues };
}

/* ---------- readiness ---------- */

/** Same margin as the car app's `EnergyPolicy.RANGE_SAFETY`: the trip must fit in the range with 20 % to spare. */
export const FLEET_RANGE_SAFETY = 1.2;
/** Older than this, the state says where the car was, not how it is now. */
export const FLEET_STALE_MS = 6 * 60 * 60 * 1000;

export type FleetLevel = 'READY' | 'CAUTION' | 'STOP';

/** Same names as the car app's Kotlin twin. */
export type FleetCheckCode =
  | 'ENERGY_SHORT'
  | 'ENERGY_LOW'
  | 'TIRE_PRESSURE'
  | 'BRAKE_FLUID_LOW'
  | 'WARNING_LAMP'
  | 'AUX_BATTERY_LOW'
  | 'WASHER_LOW'
  | 'HEADLAMP_DEFECT'
  | 'CHARGE_CABLE'
  | 'DOOR_OPEN'
  | 'TRUNK_OPEN'
  | 'STALE';

export interface FleetReadinessItem {
  code: FleetCheckCode;
  level: Exclude<FleetLevel, 'READY'>;
  detail?: Record<string, number | string[]>;
}

export interface FleetReadiness {
  level: FleetLevel;
  items: FleetReadinessItem[];
  /** Checks the vehicle has reported the inputs for. A code missing here was not checked ("not reported"), not passed. STALE needs no input and is never listed. */
  known: FleetCheckCode[];
  updatedAt: number;
}

const TIRE_LAMPS = ['WarningLamp.TirePressure.FrontLeft', 'WarningLamp.TirePressure.FrontRight', 'WarningLamp.TirePressure.RearLeft', 'WarningLamp.TirePressure.RearRight'] as const;
const FAULT_LAMPS = [
  'WarningLamp.Airbag',
  'WarningLamp.EBD',
  'WarningLamp.ABS',
  'WarningLamp.EPS',
  'WarningLamp.ChargingSystem',
  'WarningLamp.EPB',
  'WarningLamp.ESC',
  'WarningLamp.RegenerativeBrake',
  'WarningLamp.EVPowerDown',
  'WarningLamp.EVService',
] as const;

const leaf = (field: string) => field.slice(field.lastIndexOf('.') + 1);

/**
 * Pre-departure check: combines what the vehicle last reported with the distance planned for the trip.
 * A field the vehicle never reported produces no item — missing data is neither a pass nor a fail (see `known`).
 */
export function fleetReadiness(state: FleetVehicleState, opts: { tripKm?: number; now: number }): FleetReadiness {
  const v = state.values;
  const items: FleetReadinessItem[] = [];
  const known: FleetCheckCode[] = [];
  const has = (...fields: FleetField[]) => fields.some((f) => v[f] !== undefined);
  const is = (field: FleetField, ...values: string[]) => values.includes(v[field]?.value as string);
  const check = (code: FleetCheckCode, level: FleetReadinessItem['level'], reported: boolean, failed: boolean, detail?: FleetReadinessItem['detail']) => {
    if (!reported) return;
    known.push(code);
    if (failed) items.push(detail ? { code, level, detail } : { code, level });
  };

  const dteKm = v['Vehicle.DTE']?.value;
  const socPercent = v['TractionBattery.SOC']?.value;
  const tripKm = opts.tripKm !== undefined && Number.isFinite(opts.tripKm) && opts.tripKm >= 0 ? opts.tripKm : undefined;
  if (dteKm !== undefined && tripKm !== undefined) {
    check('ENERGY_SHORT', 'CAUTION', true, tripKm * FLEET_RANGE_SAFETY > dteKm, { dteKm, tripKm, ...(socPercent !== undefined ? { socPercent } : {}) });
  }
  check('ENERGY_LOW', 'STOP', has('WarningLamp.TractionBatterySOC'), is('WarningLamp.TractionBatterySOC', 'ON', 'BLINK'));
  const lowTires = TIRE_LAMPS.filter((f) => is(f, 'LOW'));
  check('TIRE_PRESSURE', 'STOP', has(...TIRE_LAMPS), lowTires.length > 0, { wheels: lowTires.map(leaf) });
  check('BRAKE_FLUID_LOW', 'STOP', has('WarningLamp.BrakeOil'), is('WarningLamp.BrakeOil', 'LOW'));
  const lamps = FAULT_LAMPS.filter((f) => is(f, 'ON', 'BLINK'));
  check('WARNING_LAMP', 'STOP', has(...FAULT_LAMPS), lamps.length > 0, { lamps: lamps.map(leaf) });
  check('AUX_BATTERY_LOW', 'CAUTION', has('WarningLamp.AuxiliaryBatterySOC'), is('WarningLamp.AuxiliaryBatterySOC', 'LOW'));
  check('WASHER_LOW', 'CAUTION', has('WarningLamp.WasherFluid'), is('WarningLamp.WasherFluid', 'LOW'));
  check('HEADLAMP_DEFECT', 'CAUTION', has('WarningLamp.HeadLamp'), is('WarningLamp.HeadLamp', 'DEFECT'));
  check('CHARGE_CABLE', 'CAUTION', has('ChargePort.Plug'), is('ChargePort.Plug', 'PLUG'));
  check('DOOR_OPEN', 'CAUTION', has('Door.Open.Driver'), is('Door.Open.Driver', 'OPEN'));
  const open = (['Trunk.Open', 'Hood.Open'] as const).filter((f) => is(f, 'OPEN'));
  check('TRUNK_OPEN', 'CAUTION', has('Trunk.Open', 'Hood.Open'), open.length > 0, { parts: open.map((f) => f.slice(0, f.indexOf('.'))) });
  if (opts.now - state.updatedAt > FLEET_STALE_MS) items.push({ code: 'STALE', level: 'CAUTION' });

  const level: FleetLevel = items.some((i) => i.level === 'STOP') ? 'STOP' : items.length ? 'CAUTION' : 'READY';
  return { level, items, known, updatedAt: state.updatedAt };
}
