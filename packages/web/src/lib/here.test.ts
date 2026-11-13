import { afterEach, describe, expect, it } from 'vitest';
import { sampleTrip } from '@tteonaljido/shared';
import { getHere, locate, locateIfAllowed, roundE7, setHere } from './here';
import { emptyRuns } from './routeTimes';
import { legKeys, setOrigin } from './trips';

const stubGeo = (value: unknown) => Object.defineProperty(navigator, 'geolocation', { value, configurable: true });

afterEach(() => {
  setHere(null);
  stubGeo(undefined);
});

describe("the phone's own position (출발 장소 '현재 위치')", () => {
  it('is rounded to about 100 m and kept as whole 1e-7 degrees', () => {
    expect(roundE7(37.4127212)).toBe(374_130_000);
    expect(roundE7(127.094681)).toBe(1_270_950_000);
    expect(Number.isInteger(roundE7(37.4127212))).toBe(true);
  });

  it('comes from the device when allowed, and is remembered for the session', async () => {
    stubGeo({ getCurrentPosition: (ok: (p: unknown) => void) => ok({ coords: { latitude: 37.4127212, longitude: 127.094681 } }) });
    expect(await locate()).toEqual({ ok: true, point: { latE7: 374_130_000, lonE7: 1_270_950_000 } });
    expect(getHere()).toEqual({ latE7: 374_130_000, lonE7: 1_270_950_000 });
    expect(await locateIfAllowed()).toEqual(getHere()); // known already: nothing is asked again
  });

  it('says why when it cannot be had', async () => {
    expect(await locate()).toEqual({ ok: false, reason: 'unsupported' });
    stubGeo({ getCurrentPosition: (_ok: unknown, fail: (e: { code: number }) => void) => fail({ code: 1 }) });
    expect(await locate()).toEqual({ ok: false, reason: 'denied' });
    stubGeo({ getCurrentPosition: (_ok: unknown, fail: (e: { code: number }) => void) => fail({ code: 3 }) });
    expect(await locate()).toEqual({ ok: false, reason: 'unavailable' });
    expect(getHere()).toBeNull();
  });

  it('times the first leg of a trip that starts from the current location, once the position is known', () => {
    const t = setOrigin(sampleTrip(), { kind: 'CURRENT' });
    expect(legKeys(t, 1)[0]).toBe('@here>cheolttuk'); // the leg follows its pair of ends like any other
    expect(emptyRuns(t).some((r) => r.dayIndex === 1 && r.fromK === 0)).toBe(false); // position unknown: left to the car
    setHere({ latE7: 374_130_000, lonE7: 1_270_950_000 });
    const run = emptyRuns(t).find((r) => r.dayIndex === 1 && r.fromK === 0)!;
    expect(run.points[0]).toEqual({ latE7: 374_130_000, lonE7: 1_270_950_000 });
    expect(run.keys[0]).toBe('@here>cheolttuk');
    // a trip that starts from home is not timed from where the phone is
    expect(emptyRuns(sampleTrip()).some((r) => r.dayIndex === 1 && r.fromK === 0)).toBe(false);
  });
});
