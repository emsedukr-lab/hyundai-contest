import { DurableObject } from 'cloudflare:workers';
import { reduceFleet, type FleetVehicleState, type FleetWebhookPayload } from '@tteonaljido/shared';
import type { Env } from './index';

const KEY = 'state';
/** Nothing lingers: a vehicle's state is deleted this long after its last webhook. */
const RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * The last known state of one Fleet vehicle (keyed by its Fleet vehicleId). One request at a time per object, so two
 * webhooks for the same vehicle cannot interleave their read-merge-write. Holds only the reduced state — no VIN, no
 * position, no request body.
 */
export class FleetVehicle extends DurableObject<Env> {
  async ingest(payload: FleetWebhookPayload): Promise<void> {
    const next = reduceFleet(await this.ctx.storage.get<FleetVehicleState>(KEY), payload);
    // A request with none of the kept fields (position only, say) must not create a record about the vehicle.
    if (!Object.keys(next.values).length) return;
    await this.ctx.storage.put(KEY, next);
    await this.ctx.storage.setAlarm(Date.now() + RETENTION_MS);
  }

  async current(): Promise<FleetVehicleState | null> {
    return (await this.ctx.storage.get<FleetVehicleState>(KEY)) ?? null;
  }

  override async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
