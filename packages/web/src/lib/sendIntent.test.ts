import { beforeEach, describe, expect, it } from 'vitest';
import { sendIntent } from './sendIntent';

describe('sendIntent', () => {
  beforeEach(() => sessionStorage.clear());

  it('hands the chosen trip to the pairing page in this window', () => {
    sendIntent.set('6f1c2d4e-8a3b-4c5d-9e7f-0a1b2c3d4e5f');
    expect(sendIntent.get()).toBe('6f1c2d4e-8a3b-4c5d-9e7f-0a1b2c3d4e5f');
  });

  it('forgets a choice older than half an hour, a cleared one and anything malformed', () => {
    sendIntent.set('a');
    expect(sendIntent.get(Date.now() + 31 * 60_000)).toBeNull();
    sendIntent.clear();
    expect(sendIntent.get()).toBeNull();
    sessionStorage.setItem('tteonaljido.sendTrip', '{"tripId":7}');
    expect(sendIntent.get()).toBeNull();
    sessionStorage.setItem('tteonaljido.sendTrip', 'not json');
    expect(sendIntent.get()).toBeNull();
  });
});
