/**
 * Local demonstration of the Pleos Fleet webhook receiver against `wrangler dev` — not a test of the live service:
 * Fleet API endpoints are only handed out after a Pleos Fleet contract, so this plays Pleos Fleet's part with the
 * payload examples printed in its docs, then asks for the readiness of a 207 km trip.
 *
 * The receiver is off unless the Worker has FLEET_WEBHOOK_TOKEN (the deployment has none). To switch it on locally:
 *   1. packages/worker/.dev.vars  →  FLEET_WEBHOOK_TOKEN=<any value you make up>   (git-ignored; never commit a real token)
 *   2. npm run dev
 *   3. FLEET_WEBHOOK_TOKEN=<the same value> npx tsx tools/fleet-webhook-sample.mts http://localhost:8787
 *
 * The printed examples are dated 2025, which the readiness check can only call stale, so they are sent as if recorded
 * now (every time moved by one offset). Add --as-printed to send them untouched: on a vehicle with no newer state that
 * shows STALE; after a normal run it changes nothing, because the newest reading wins.
 */
import { FLEET_DOC_EXAMPLES, restampFleetExample } from '../packages/shared/src/index';

const args = process.argv.slice(2);
const asPrinted = args.includes('--as-printed');
const base = (args.find((a) => !a.startsWith('--')) ?? 'http://localhost:8787').replace(/\/$/, '');
const token = process.env.FLEET_WEBHOOK_TOKEN;
if (!token) {
  console.error('Set FLEET_WEBHOOK_TOKEN to the value in packages/worker/.dev.vars (see the header of this file).');
  process.exit(1);
}
const step = (s: string) => console.log(`✓ ${s}`);

const now = Date.now();
for (const [name, example] of Object.entries(FLEET_DOC_EXAMPLES)) {
  const res = await fetch(`${base}/api/v1/fleet/webhook`, {
    method: 'POST',
    // The headers the docs list for a webhook request, plus the Custom Header an operator registers in Pleos Fleet.
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-API-Version': 'v1.0',
      ...(name.startsWith('periodic') ? { 'X-42dot-transmissionType': '10S_30S' } : {}),
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(asPrinted ? example : restampFleetExample(example, now)),
  });
  const answer = await res.text();
  if (res.status === 404) throw new Error('404: the receiver is off — is FLEET_WEBHOOK_TOKEN in packages/worker/.dev.vars, and wrangler dev restarted?');
  if (!res.ok) throw new Error(`${name} -> ${res.status} ${answer}`);
  step(`${name} -> ${res.status} ${answer}`);
}

const vehicleId = FLEET_DOC_EXAMPLES.periodic1.vehicleId;
const res = await fetch(`${base}/api/v1/fleet/vehicles/${vehicleId}/readiness?km=207`, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) throw new Error(`readiness -> ${res.status} ${await res.text()}`);
console.log('readiness for a 207 km trip:');
console.log(JSON.stringify(await res.json(), null, 2));
