/**
 * "Send THIS trip": set when 카메라로 차량 QR 스캔 is pressed on a trip's send sheet, read once by the pairing page so
 * its 차량으로 보낼 여행 step opens with that trip chosen. Only the trip's id, only in this window's sessionStorage, and
 * only for a while — never in the address (docs/03_개인정보_설계.md: no trip data in a path, query or QR). A scan started from the
 * 연결 tab clears it, so an older choice never rides along.
 */
const KEY = 'tteonaljido.sendTrip';
const MAX_AGE = 30 * 60_000;

export const sendIntent = {
  set(tripId: string) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ tripId, at: Date.now() }));
    } catch {
      /* some private modes: the pairing page simply starts with nothing chosen */
    }
  },
  get(now = Date.now()): string | null {
    try {
      const raw = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as { tripId?: unknown; at?: unknown } | null;
      if (!raw || typeof raw.tripId !== 'string' || typeof raw.at !== 'number' || now - raw.at > MAX_AGE || now < raw.at) return null;
      return raw.tripId;
    } catch {
      return null;
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  },
};
