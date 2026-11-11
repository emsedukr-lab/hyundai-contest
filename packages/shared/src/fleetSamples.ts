import { parseFleetTime } from './fleet';

/**
 * The payload examples printed in the Pleos Fleet API webhook docs (Periodic Data examples 1-3, Vehicle event
 * example 1), copied as printed — including where they contradict the docs' own schema table. They are the only
 * evidence of the wire format available without a Pleos Fleet contract, so the tests and the local demo script
 * (tools/fleet-webhook-sample.mts) use exactly these. The VIN and vehicle id are the docs' placeholders.
 */
export const FLEET_DOC_EXAMPLES = {
  /** Speed, odometer and position: three samples 10 s apart, newest first. */
  periodic1: {
    vin: 'HMGSDV00000000001',
    vehicleId: 'e79049fb-e744-11ef-8dd9-f56aaa011ede',
    itemsCount: 3,
    items: [
      {
        messageTime: '2025-02-12T08:12:58.628000000Z',
        data: {
          Vehicle: {
            Speed: { value: 33.0, eventTime: '2025-02-12T08:12:58.628000000Z' },
            Odometer: { value: 85488.20000000001, eventTime: '2025-02-12T08:12:58.628000000Z' },
            Longitude: { value: -154.91031883652636, eventTime: '2025-02-12T08:12:58.628000000Z' },
            Latitude: { value: -18.69372709987225, eventTime: '2025-02-12T08:12:58.628000000Z' },
          },
        },
      },
      {
        messageTime: '2025-02-12T08:12:48.529000000Z',
        data: {
          Vehicle: {
            Speed: { value: 33.0, eventTime: '2025-02-12T08:12:48.529000000Z' },
            Odometer: { value: 85488.20000000001, eventTime: '2025-02-12T08:12:48.529000000Z' },
            Longitude: { value: -19.375769325931543, eventTime: '2025-02-12T08:12:48.529000000Z' },
            Latitude: { value: -76.1095325617343, eventTime: '2025-02-12T08:12:48.529000000Z' },
          },
        },
      },
      {
        messageTime: '2025-02-12T08:12:38.433000000Z',
        data: {
          Vehicle: {
            Speed: { value: 33.0, eventTime: '2025-02-12T08:12:38.433000000Z' },
            Odometer: { value: 85488.20000000001, eventTime: '2025-02-12T08:12:38.433000000Z' },
            Longitude: { value: -14.687766053318, eventTime: '2025-02-12T08:12:38.433000000Z' },
            Latitude: { value: 0.07465427590453544, eventTime: '2025-02-12T08:12:38.433000000Z' },
          },
        },
      },
    ],
  },
  /** Tire pressure at `data.Tire.Pressure` (the schema table says `data.Vehicle.Tire.Pressure`), 12 V battery, and an Acceleration group the table does not list. */
  periodic2: {
    vin: 'HMGSDV00000000001',
    vehicleId: 'e79049fb-e744-11ef-8dd9-f56aaa011ede',
    itemsCount: 1,
    items: [
      {
        messageTime: '2025-02-12T08:12:58.628000000Z',
        data: {
          Tire: {
            Pressure: {
              FrontLeft: { value: 37.0, eventTime: '2025-02-12T08:12:58.628000000Z' },
              RearRight: { value: 37.0, eventTime: '2025-02-12T08:12:58.628000000Z' },
              RearLeft: { value: 37.0, eventTime: '2025-02-12T08:12:58.628000000Z' },
              FrontRight: { value: 37.0, eventTime: '2025-02-12T08:12:58.628000000Z' },
            },
          },
          AuxiliaryBattery: { Voltage: { value: 14.685, eventTime: '2025-02-12T08:12:58.628000000Z' } },
          Acceleration: {
            Longitudinal: { value: -0.023326094999999825, eventTime: '2025-02-12T08:12:58.628000000Z' },
            Lateral: { value: 0.025875394999999912, eventTime: '2025-02-12T08:12:58.628000000Z' },
          },
        },
      },
    ],
  },
  /** Charging state (its eventTime two months older than the message), range and battery level. */
  periodic3: {
    vin: 'HMGSDV00000000001',
    vehicleId: 'e79049fb-e744-11ef-8dd9-f56aaa011ede',
    itemsCount: 1,
    items: [
      {
        messageTime: '2025-02-12T08:12:58.628000000Z',
        data: {
          ChargeSystem: { Active: { value: 'INACTIVE', eventTime: '2024-12-12T08:24:09.107000000Z' } },
          Vehicle: { DTE: { value: 412.0, eventTime: '2025-02-12T08:12:58.628000000Z' } },
          TractionBattery: { SOC: { value: 95.0, eventTime: '2025-02-12T08:12:58.628000000Z' } },
        },
      },
    ],
  },
  /** As printed: `itemsCount` 3 for one item, and the seat belt under `data.Vehicle.Seat` as a boolean (the table says `data.Seat.Buckle.Driver`, "BUCKLE"/"UNBUCKLE"). */
  event1: {
    vin: 'HMGSDV00000000001',
    vehicleId: 'e79049fb-e744-11ef-8dd9-f56aaa011ede',
    itemsCount: 3,
    items: [
      {
        messageTime: '2025-02-12T08:12:58.628000000Z',
        data: { Vehicle: { Seat: { Buckle: { Driver: { value: false, eventTime: '2025-01-31T01:17:40.702000000Z' } } } } },
      },
    ],
  },
};

/**
 * The same example as if sent at `now`: every messageTime and eventTime moves by one offset, so the gaps between them
 * stay as printed. The printed dates are from 2025, which a readiness check can only call stale.
 */
export function restampFleetExample<T extends { items: { messageTime: string }[] }>(example: T, now: number): T {
  const shift = now - Math.max(...example.items.map((i) => parseFleetTime(i.messageTime) ?? 0));
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v !== 'object' || v === null) return v;
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => {
        const t = k === 'messageTime' || k === 'eventTime' ? parseFleetTime(x) : null;
        return [k, t === null ? walk(x) : new Date(t + shift).toISOString()];
      }),
    );
  };
  return walk(example) as T;
}
