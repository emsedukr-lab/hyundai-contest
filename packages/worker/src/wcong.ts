/**
 * Kakao Map's WCONGNAMUL coordinates (what its static-map previews use) → WGS84 latitude/longitude.
 *
 * WCONGNAMUL is the old Korean Transverse Mercator grid (Bessel 1841, origin 38°N / 127°0′10.405″E, false easting
 * 200 000 m, false northing 500 000 m, scale 1) multiplied by 2.5. So: divide by 2.5, invert the projection on the
 * Bessel ellipsoid, then move the Bessel (Tokyo datum) position onto WGS84 with a 7-parameter Helmert shift.
 * Accurate to a few metres in Korea — plenty for finding the nearest shop. Pure, no I/O.
 */

const RAD = Math.PI / 180;
const SEC = RAD / 3600;

const BESSEL = { a: 6377397.155, f: 1 / 299.1528128 };
const WGS84 = { a: 6378137, f: 1 / 298.257223563 };

const LAT0 = 38 * RAD;
const LON0 = 127 * RAD + 10.405 * SEC;
const K0 = 1;
const FE = 200000;
const FN = 500000;

/** Bessel → WGS84 (towgs84 of the Korean Tokyo datum): metres, arc-seconds, ppm. */
const SHIFT = { dx: -115.8, dy: 474.99, dz: 674.11, rx: 1.16, ry: -2.31, rz: -1.63, ppm: 6.43 };

/** Meridian arc length from the equator to latitude `phi` on an ellipsoid with eccentricity² `e2`. */
function meridian(a: number, e2: number, phi: number): number {
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  return (
    a *
    ((1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * e2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi))
  );
}

/** Inverse Transverse Mercator on Bessel: grid metres → [lat, lon] in radians. */
function inverseTm(x: number, y: number): [number, number] {
  const { a, f } = BESSEL;
  const e2 = f * (2 - f);
  const ep2 = e2 / (1 - e2);
  const m = meridian(a, e2, LAT0) + (y - FN) / K0;
  const mu = m / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 * e2 * e2) / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const c1 = ep2 * cos1 * cos1;
  const t1 = tan1 * tan1;
  const n1 = a / Math.sqrt(1 - e2 * sin1 * sin1);
  const r1 = (a * (1 - e2)) / (1 - e2 * sin1 * sin1) ** 1.5;
  const d = (x - FE) / (n1 * K0);
  const lat =
    phi1 -
    ((n1 * tan1) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6) / 720);
  const lon = LON0 + (d - ((1 + 2 * t1 + c1) * d ** 3) / 6 + ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5) / 120) / cos1;
  return [lat, lon];
}

function toEcef(lat: number, lon: number, h: number, { a, f }: { a: number; f: number }): [number, number, number] {
  const e2 = f * (2 - f);
  const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return [(n + h) * Math.cos(lat) * Math.cos(lon), (n + h) * Math.cos(lat) * Math.sin(lon), (n * (1 - e2) + h) * Math.sin(lat)];
}

function fromEcef(x: number, y: number, z: number, { a, f }: { a: number; f: number }): [number, number] {
  const e2 = f * (2 - f);
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - e2));
  for (let i = 0; i < 6; i++) {
    const n = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
    const h = p / Math.cos(lat) - n;
    lat = Math.atan2(z, p * (1 - (e2 * n) / (n + h)));
  }
  return [lat, Math.atan2(y, x)];
}

/** One WCONGNAMUL point → `{ lat, lon }` in WGS84 degrees. */
export function wcongToWgs84(wx: number, wy: number): { lat: number; lon: number } {
  const [lat, lon] = inverseTm(wx / 2.5, wy / 2.5);
  const [x, y, z] = toEcef(lat, lon, 0, BESSEL);
  const { dx, dy, dz, ppm } = SHIFT;
  const rx = SHIFT.rx * SEC;
  const ry = SHIFT.ry * SEC;
  const rz = SHIFT.rz * SEC;
  const s = 1 + ppm * 1e-6;
  // Position-vector rotation (the convention of proj's towgs84).
  const x2 = dx + s * (x - rz * y + ry * z);
  const y2 = dy + s * (rz * x + y - rx * z);
  const z2 = dz + s * (-ry * x + rx * y + z);
  const [la, lo] = fromEcef(x2, y2, z2, WGS84);
  return { lat: la / RAD, lon: lo / RAD };
}
