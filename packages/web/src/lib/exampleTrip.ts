import example from '../data/gangneung-example.json';
import { checkBackupTrip } from './backup';
import { trips } from './db';

export const EXAMPLE_TRIP_ID = example.tripId;

/** Public places only; this is the same itinerary used in the phone/car demonstration. */
export async function ensureExampleTrip() {
  const doc = await checkBackupTrip(example);
  if (!doc) throw new Error('Invalid bundled example trip');
  await trips.seedExample(doc);
}
