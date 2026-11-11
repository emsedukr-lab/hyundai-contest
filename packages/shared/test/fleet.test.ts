import { describe, expect, it } from 'vitest';
import {
  FLEET_DOC_EXAMPLES as DOC,
  FLEET_FIELDS,
  FLEET_MAX_ITEMS,
  FLEET_STALE_MS,
  fleetReadiness,
  parseFleetTime,
  parseFleetWebhook,
  reduceFleet,
  restampFleetExample,
  type FleetReadiness,
  type FleetVehicleState,
  type FleetWebhookPayload,
} from '../src/index';

const VID = DOC.periodic1.vehicleId;
const T0 = Date.parse('2026-11-12T09:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

const parsed = (body: unknown): FleetWebhookPayload => {
  const r = parseFleetWebhook(body);
  if (!r.ok) throw new Error(`expected a valid body: ${JSON.stringify(r.errors)}`);
  return r.payload;
};
const errorsOf = (body: unknown) => {
  const r = parseFleetWebhook(body);
  return r.ok ? [] : r.errors;
};

/** One-item request: `data` as given, every leaf stamped `at` unless it carries its own eventTime. */
const body = (data: Record<string, unknown>, at = T0) => ({ vin: 'HMGSDV00000000001', vehicleId: VID, itemsCount: 1, items: [{ messageTime: iso(at), data }] });
const vo = (value: unknown, at = T0) => ({ value, eventTime: iso(at) });
const stateOf = (data: Record<string, unknown>, at = T0): FleetVehicleState => reduceFleet(undefined, parsed(body(data, at)));
const codes = (r: FleetReadiness) => r.items.map((i) => i.code);

describe('Pleos Fleet 웹훅 — 문서의 payload 예시 (documented examples)', () => {
  it('periodic example 1: keeps the newest of three samples, and no position', () => {
    const p = parsed(DOC.periodic1);
    expect(p.items).toHaveLength(3);
    const s = reduceFleet(undefined, p);
    const newest = Date.parse('2025-02-12T08:12:58.628Z');
    expect(s).toEqual({
      vehicleId: VID,
      updatedAt: newest,
      values: { 'Vehicle.Odometer': { value: 85488.20000000001, eventTime: newest }, 'Vehicle.Speed': { value: 33, eventTime: newest } },
    });
  });

  it('periodic example 2: reads tire pressure where the example puts it (no leading Vehicle.) and skips Acceleration', () => {
    const s = reduceFleet(undefined, parsed(DOC.periodic2));
    expect(Object.keys(s.values).sort()).toEqual([
      'AuxiliaryBattery.Voltage',
      'Vehicle.Tire.Pressure.FrontLeft',
      'Vehicle.Tire.Pressure.FrontRight',
      'Vehicle.Tire.Pressure.RearLeft',
      'Vehicle.Tire.Pressure.RearRight',
    ]);
    expect(s.values['Vehicle.Tire.Pressure.RearRight']?.value).toBe(37);
    expect(s.values['AuxiliaryBattery.Voltage']?.value).toBe(14.685);
  });

  it('periodic example 3: each value keeps its own eventTime', () => {
    const s = reduceFleet(undefined, parsed(DOC.periodic3));
    expect(s.values['TractionBattery.SOC']).toEqual({ value: 95, eventTime: Date.parse('2025-02-12T08:12:58.628Z') });
    expect(s.values['Vehicle.DTE']?.value).toBe(412);
    expect(s.values['ChargeSystem.Active']).toEqual({ value: 'INACTIVE', eventTime: Date.parse('2024-12-12T08:24:09.107Z') });
    expect(s.updatedAt).toBe(Date.parse('2025-02-12T08:12:58.628Z'));
  });

  it('event example: itemsCount 3 with one item is accepted; the boolean under Vehicle.Seat becomes the documented enum', () => {
    const p = parsed(DOC.event1);
    expect(p.items).toHaveLength(1);
    const s = reduceFleet(undefined, p);
    expect(s.values).toEqual({ 'Seat.Buckle.Driver': { value: 'UNBUCKLE', eventTime: Date.parse('2025-01-31T01:17:40.702Z') } });
  });

  it('all four fold into one state', () => {
    const s = [DOC.periodic1, DOC.periodic2, DOC.periodic3, DOC.event1].reduce<FleetVehicleState | undefined>((acc, ex) => reduceFleet(acc, parsed(ex)), undefined)!;
    expect(Object.keys(s.values)).toHaveLength(11);
    expect(s.updatedAt).toBe(Date.parse('2025-02-12T08:12:58.628Z'));
  });

  it('never stores the VIN or the position (개인정보·위치 최소화)', () => {
    const p = parsed(DOC.periodic1);
    expect(p).not.toHaveProperty('vin');
    const stored = JSON.stringify([DOC.periodic1, DOC.periodic2, DOC.periodic3, DOC.event1].reduce<FleetVehicleState | undefined>((acc, ex) => reduceFleet(acc, parsed(ex)), undefined));
    for (const leak of ['"vin"', 'HMGSDV', 'Latitude', 'Longitude', '-154.91', '-18.69', '-76.10', '-19.37', '-14.68', '0.0746']) expect(stored).not.toContain(leak);
    // Also when the position arrives without the Vehicle. segment.
    expect(JSON.stringify(stateOf({ Latitude: vo(37.75), Longitude: vo(128.87), Speed: vo(10) }))).not.toMatch(/Latitude|Longitude|37\.75|128\.87/);
  });

  it('restamping an example moves every time by one offset', () => {
    const s = reduceFleet(undefined, parsed(restampFleetExample(DOC.periodic3, T0)));
    expect(s.updatedAt).toBe(T0);
    const gap = Date.parse('2025-02-12T08:12:58.628Z') - Date.parse('2024-12-12T08:24:09.107Z');
    expect(s.values['ChargeSystem.Active']?.eventTime).toBe(T0 - gap);
    expect(DOC.periodic3.items[0].messageTime).toBe('2025-02-12T08:12:58.628000000Z'); // the printed example is untouched
  });
});

describe('Pleos Fleet 웹훅 — 상태 누적 (reduceFleet)', () => {
  it('keeps the 40 documented fields and nothing about identity or position', () => {
    const kept = Object.keys(FLEET_FIELDS);
    expect(kept).toHaveLength(40);
    expect(kept.filter((f) => f.startsWith('WarningLamp.'))).toHaveLength(19);
    expect(kept.filter((f) => f.split('.').some((part) => /^(vin|latitude|longitude)$/i.test(part)))).toEqual([]);
  });

  it('newest wins: an older reading never overwrites, a newer one does', () => {
    const first = stateOf({ TractionBattery: { SOC: vo(80, T0) } });
    const late = reduceFleet(first, parsed(body({ TractionBattery: { SOC: vo(90, T0 - 60_000) } }, T0 + 5_000)));
    expect(late.values['TractionBattery.SOC']).toEqual({ value: 80, eventTime: T0 });
    expect(late.updatedAt).toBe(T0);
    const newer = reduceFleet(late, parsed(body({ TractionBattery: { SOC: vo(79, T0 + 60_000) } })));
    expect(newer.values['TractionBattery.SOC']).toEqual({ value: 79, eventTime: T0 + 60_000 });
    expect(newer.updatedAt).toBe(T0 + 60_000);
  });

  it('a repeated delivery changes nothing', () => {
    const once = reduceFleet(undefined, parsed(DOC.periodic3));
    expect(reduceFleet(once, parsed(DOC.periodic3))).toEqual(once);
  });

  it('falls back to messageTime when a value has no readable eventTime', () => {
    const s = stateOf({ Vehicle: { DTE: { value: 300 }, Odometer: { value: 10, eventTime: 'yesterday' } } }, T0 + 1_000);
    expect(s.values['Vehicle.DTE']).toEqual({ value: 300, eventTime: T0 + 1_000 });
    expect(s.values['Vehicle.Odometer']?.eventTime).toBe(T0 + 1_000);
  });

  it('reads a field with or without the leading Vehicle. segment, the documented path first', () => {
    expect(stateOf({ Vehicle: { Tire: { Pressure: { FrontLeft: vo(36) } } } }).values['Vehicle.Tire.Pressure.FrontLeft']?.value).toBe(36);
    expect(stateOf({ Tire: { Pressure: { FrontLeft: vo(35) } } }).values['Vehicle.Tire.Pressure.FrontLeft']?.value).toBe(35);
    expect(stateOf({ Seat: { Buckle: { Passenger: vo('BUCKLE') } } }).values['Seat.Buckle.Passenger']?.value).toBe('BUCKLE');
    expect(stateOf({ Vehicle: { WarningLamp: { ABS: vo('ON') } } }).values['WarningLamp.ABS']?.value).toBe('ON');
    expect(stateOf({ Vehicle: { DTE: vo(400) }, DTE: vo(1) }).values['Vehicle.DTE']?.value).toBe(400);
  });

  it('accepts the documented strings and booleans (true = the state the field is named after)', () => {
    const s = stateOf({
      Seat: { Buckle: { Driver: vo(true), Passenger: vo('UNBUCKLE') } },
      Door: { Open: { Driver: vo(false) }, Lock: { Driver: vo('lock') } },
      ChargePort: { Plug: vo(true) },
      ParkingBrake: { Engage: vo(false) },
      Vehicle: { DrivingReady: vo(true) },
      WarningLamp: { ABS: vo('BLINK'), EPS: vo(false), TirePressure: { RearLeft: vo(true) }, HeadLamp: vo('NORMAL') },
    });
    expect(Object.fromEntries(Object.entries(s.values).map(([k, r]) => [k, r.value]))).toEqual({
      'Seat.Buckle.Driver': 'BUCKLE',
      'Seat.Buckle.Passenger': 'UNBUCKLE',
      'Door.Open.Driver': 'CLOSE',
      'Door.Lock.Driver': 'LOCK',
      'ChargePort.Plug': 'PLUG',
      'ParkingBrake.Engage': 'DISENGAGE',
      'Vehicle.DrivingReady': 'ON',
      'WarningLamp.ABS': 'BLINK',
      'WarningLamp.EPS': 'OFF',
      'WarningLamp.TirePressure.RearLeft': 'LOW',
      'WarningLamp.HeadLamp': 'NORMAL',
    });
  });

  it('skips values outside the documented type, and fields it does not keep', () => {
    const s = stateOf({
      TractionBattery: { SOC: vo('95'), RegenerativeEnergy: vo(1.2) },
      Vehicle: { DTE: vo(Number.NaN), Speed: 12, Ignition2: vo('ON') },
      WarningLamp: { ABS: vo('MAYBE'), BrakeOil: vo(1) },
      Door: { Open: vo('OPEN') },
      __proto__: { Hood: { Open: vo('OPEN') } },
    });
    expect(s.values).toEqual({});
    expect(s.updatedAt).toBe(0);
  });

  it("does not continue another vehicle's state", () => {
    const other = { ...stateOf({ Vehicle: { DTE: vo(100) } }), vehicleId: 'someone-else' };
    expect(reduceFleet(other, parsed(body({ Vehicle: { Speed: vo(5) } }))).values).toEqual({ 'Vehicle.Speed': { value: 5, eventTime: T0 } });
  });
});

describe('Pleos Fleet 웹훅 — 출발 전 점검 (fleetReadiness)', () => {
  const good = {
    TractionBattery: { SOC: vo(95) },
    Vehicle: { DTE: vo(412) },
    ChargePort: { Plug: vo('UNPLUG') },
    Door: { Open: { Driver: vo('CLOSE') } },
    Hood: { Open: vo('CLOSE') },
    Trunk: { Open: vo('CLOSE') },
    WarningLamp: {
      Airbag: vo('OFF'),
      EBD: vo('OFF'),
      ABS: vo('OFF'),
      EPS: vo('OFF'),
      ChargingSystem: vo('OFF'),
      TirePressure: { FrontLeft: vo('NORMAL'), FrontRight: vo('NORMAL'), RearLeft: vo('NORMAL'), RearRight: vo('NORMAL') },
      HeadLamp: vo('NORMAL'),
      EPB: vo('OFF'),
      ESC: vo('OFF'),
      RegenerativeBrake: vo('OFF'),
      TractionBatterySOC: vo('OFF'),
      EVPowerDown: vo('OFF'),
      EVService: vo('OFF'),
      WasherFluid: vo('NORMAL'),
      BrakeOil: vo('NORMAL'),
      AuxiliaryBatterySOC: vo('NORMAL'),
    },
  };
  const ready = (data: Record<string, unknown>, opts: { tripKm?: number; now?: number } = {}) => fleetReadiness(stateOf(data), { tripKm: opts.tripKm, now: opts.now ?? T0 });
  const lampsWith = (patch: Record<string, unknown>) => ({ ...good, WarningLamp: { ...good.WarningLamp, ...patch } });

  it('READY when everything reported is fine and the trip fits the range', () => {
    const r = ready(good, { tripKm: 207 });
    expect(r).toMatchObject({ level: 'READY', items: [], updatedAt: T0 });
    expect(r.known).toEqual(['ENERGY_SHORT', 'ENERGY_LOW', 'TIRE_PRESSURE', 'BRAKE_FLUID_LOW', 'WARNING_LAMP', 'AUX_BATTERY_LOW', 'WASHER_LOW', 'HEADLAMP_DEFECT', 'CHARGE_CABLE', 'DOOR_OPEN', 'TRUNK_OPEN']);
  });

  it('ENERGY_SHORT: the trip needs 1.2x its distance in range (same margin as the car)', () => {
    expect(ready(good, { tripKm: 343 }).level).toBe('READY'); // 411.6 <= 412
    const short = ready(good, { tripKm: 344 }); // 412.8 > 412
    expect(short.level).toBe('CAUTION');
    expect(short.items).toEqual([{ code: 'ENERGY_SHORT', level: 'CAUTION', detail: { dteKm: 412, tripKm: 344, socPercent: 95 } }]);
    expect(ready({ Vehicle: { DTE: vo(100) } }, { tripKm: 400 }).items[0].detail).toEqual({ dteKm: 100, tripKm: 400 });
  });

  it('ENERGY_SHORT is not checked without a range or a trip distance', () => {
    expect(ready(good).known).not.toContain('ENERGY_SHORT');
    expect(ready({ TractionBattery: { SOC: vo(5) } }, { tripKm: 400 })).toMatchObject({ level: 'READY', known: [] });
    expect(ready(good, { tripKm: Number.NaN }).known).not.toContain('ENERGY_SHORT');
  });

  it.each([
    ['ENERGY_LOW', { TractionBatterySOC: vo('ON') }, undefined],
    ['ENERGY_LOW', { TractionBatterySOC: vo('BLINK') }, undefined],
    ['TIRE_PRESSURE', { TirePressure: { FrontLeft: vo('NORMAL'), FrontRight: vo('LOW'), RearLeft: vo('LOW'), RearRight: vo('NORMAL') } }, { wheels: ['FrontRight', 'RearLeft'] }],
    ['BRAKE_FLUID_LOW', { BrakeOil: vo('LOW') }, undefined],
    ['WARNING_LAMP', { ABS: vo('ON'), EVService: vo('BLINK') }, { lamps: ['ABS', 'EVService'] }],
  ])('%s stops the departure', (code, patch, detail) => {
    const r = ready(lampsWith(patch), { tripKm: 207 });
    expect(r.level).toBe('STOP');
    expect(r.items).toEqual([detail ? { code, level: 'STOP', detail } : { code, level: 'STOP' }]);
  });

  it('WARNING_LAMP covers each of the ten fault lamps', () => {
    for (const lamp of ['Airbag', 'EBD', 'ABS', 'EPS', 'ChargingSystem', 'EPB', 'ESC', 'RegenerativeBrake', 'EVPowerDown', 'EVService']) {
      expect(ready({ WarningLamp: { [lamp]: vo('ON') } }).items).toEqual([{ code: 'WARNING_LAMP', level: 'STOP', detail: { lamps: [lamp] } }]);
    }
  });

  it.each([
    ['AUX_BATTERY_LOW', lampsWith({ AuxiliaryBatterySOC: vo('LOW') }), undefined],
    ['WASHER_LOW', lampsWith({ WasherFluid: vo('LOW') }), undefined],
    ['HEADLAMP_DEFECT', lampsWith({ HeadLamp: vo('DEFECT') }), undefined],
    ['CHARGE_CABLE', { ...good, ChargePort: { Plug: vo('PLUG') } }, undefined],
    ['DOOR_OPEN', { ...good, Door: { Open: { Driver: vo('OPEN') } } }, undefined],
    ['TRUNK_OPEN', { ...good, Trunk: { Open: vo('OPEN') } }, { parts: ['Trunk'] }],
    ['TRUNK_OPEN', { ...good, Hood: { Open: vo('OPEN') } }, { parts: ['Hood'] }],
  ])('%s is a caution', (code, data, detail) => {
    const r = ready(data, { tripKm: 207 });
    expect(r.level).toBe('CAUTION');
    expect(r.items).toEqual([detail ? { code, level: 'CAUTION', detail } : { code, level: 'CAUTION' }]);
  });

  it('STALE once the newest reading is more than six hours old', () => {
    expect(ready(good, { now: T0 + FLEET_STALE_MS }).level).toBe('READY');
    expect(ready(good, { now: T0 + FLEET_STALE_MS + 1 })).toMatchObject({ level: 'CAUTION', items: [{ code: 'STALE', level: 'CAUTION' }] });
    expect(FLEET_STALE_MS).toBe(6 * 60 * 60 * 1000);
  });

  it('one STOP outranks any number of cautions; items keep a fixed order', () => {
    const r = ready({ ...lampsWith({ BrakeOil: vo('LOW'), WasherFluid: vo('LOW') }), ChargePort: { Plug: vo('PLUG') } }, { tripKm: 400, now: T0 + FLEET_STALE_MS + 1 });
    expect(r.level).toBe('STOP');
    expect(codes(r)).toEqual(['ENERGY_SHORT', 'BRAKE_FLUID_LOW', 'WASHER_LOW', 'CHARGE_CABLE', 'STALE']);
  });

  it('a field never reported is neither a pass nor a fail', () => {
    const r = ready({ Vehicle: { Speed: vo(0) }, WarningLamp: { TirePressure: { FrontLeft: vo('NORMAL') } } }, { tripKm: 207 });
    expect(r).toMatchObject({ level: 'READY', items: [], known: ['TIRE_PRESSURE'] });
  });

  it('the documented examples alone, checked today, are only stale', () => {
    const s = [DOC.periodic3, DOC.event1].reduce<FleetVehicleState | undefined>((acc, ex) => reduceFleet(acc, parsed(ex)), undefined)!;
    expect(fleetReadiness(s, { tripKm: 207, now: T0 })).toMatchObject({ level: 'CAUTION', items: [{ code: 'STALE' }], known: ['ENERGY_SHORT'] });
    expect(codes(fleetReadiness(s, { tripKm: 400, now: s.updatedAt }))).toEqual(['ENERGY_SHORT']);
  });
});

describe('Pleos Fleet 웹훅 — 요청 검증 (parseFleetWebhook)', () => {
  const required = { message: 'This field is required.', code: 'ERR_MISSING_FIELD' };

  it('reports every missing required field by name', () => {
    expect(errorsOf({})).toEqual([
      { field: 'vin', ...required },
      { field: 'vehicleId', ...required },
      { field: 'items', ...required },
    ]);
    for (const notAnObject of [null, [], 'text', 7]) expect(errorsOf(notAnObject).map((e) => e.field)).toEqual(['vin', 'vehicleId', 'items']);
    expect(errorsOf({ vin: 'V', vehicleId: VID, items: [{}] })).toEqual([
      { field: 'items[0].messageTime', ...required },
      { field: 'items[0].data', ...required },
    ]);
  });

  it('reports values of the wrong type or range as ERR_INVALID_VALUE', () => {
    const bad = errorsOf({ vin: 17, vehicleId: 'a/b', itemsCount: 1.5, items: [{ messageTime: '2025-02-12 08:12', data: [] }, 'x'] });
    expect(bad.map((e) => [e.field, e.code])).toEqual([
      ['vin', 'ERR_INVALID_VALUE'],
      ['vehicleId', 'ERR_INVALID_VALUE'],
      ['itemsCount', 'ERR_INVALID_VALUE'],
      ['items[0].messageTime', 'ERR_INVALID_VALUE'],
      ['items[0].data', 'ERR_INVALID_VALUE'],
      ['items[1]', 'ERR_INVALID_VALUE'],
    ]);
    expect(bad.every((e) => e.message.length > 0)).toBe(true);
    expect(errorsOf({ vin: 'V', vehicleId: VID, items: {} })).toMatchObject([{ field: 'items', code: 'ERR_INVALID_VALUE' }]);
    expect(errorsOf({ vin: '', vehicleId: 'x'.repeat(65), itemsCount: -1, items: [] }).map((e) => e.field)).toEqual(['vin', 'vehicleId', 'itemsCount']);
  });

  it('caps items, and the number of errors it sends back', () => {
    const item = { messageTime: iso(T0), data: {} };
    expect(parseFleetWebhook({ vin: 'V', vehicleId: VID, items: Array(FLEET_MAX_ITEMS).fill(item) }).ok).toBe(true);
    expect(errorsOf({ vin: 'V', vehicleId: VID, items: Array(FLEET_MAX_ITEMS + 1).fill(item) })).toMatchObject([{ field: 'items', code: 'ERR_INVALID_VALUE' }]);
    expect(errorsOf({ vin: 'V', vehicleId: VID, items: Array(FLEET_MAX_ITEMS).fill({}) })).toHaveLength(20);
  });

  it('itemsCount is optional and an empty items array is a valid (empty) request', () => {
    expect(parsed({ vin: 'V', vehicleId: VID, items: [] })).toEqual({ vehicleId: VID, items: [] });
  });

  it('reads ISO 8601 times with nanoseconds or an offset, and refuses anything ambiguous', () => {
    expect(parseFleetTime('2025-02-12T08:12:58.628000000Z')).toBe(Date.parse('2025-02-12T08:12:58.628Z'));
    expect(parseFleetTime('2025-02-12T08:12:58Z')).toBe(Date.parse('2025-02-12T08:12:58.000Z'));
    expect(parseFleetTime('2025-02-12T17:12:58.6+09:00')).toBe(Date.parse('2025-02-12T08:12:58.600Z'));
    expect(parseFleetTime('2025-02-12T03:12:58-0500')).toBe(Date.parse('2025-02-12T08:12:58.000Z'));
    for (const bad of ['2025-02-12T08:12:58', '2025-02-12', '2025-02-30T00:00:00Z', '2025-13-01T00:00:00Z', '2025-02-12T24:00:00Z', '2025-02-12T08:60:00Z', '', 1739347978628, null, undefined]) {
      expect(parseFleetTime(bad)).toBeNull();
    }
  });
});
