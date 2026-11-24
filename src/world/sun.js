/**
 * Where the sun is in the sky for a given moment and place. Plain JS (no
 * three.js) so the terrain build tool can use it too.
 *
 * Standard low-precision solar position (accurate to well under a degree —
 * far more than enough for lighting).
 */
const rad = Math.PI / 180;

/** @returns {{ azimuth: number, elevation: number }} degrees; azimuth clockwise from north */
export function sunPosition(date, lat, lon) {
  const n = date.getTime() / 86400000 + 2440587.5 - 2451545.0; // days since J2000
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const eps = (23.439 - 0.0000004 * n) * rad;

  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));

  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const H = (gmst * 15 + lon) * rad - ra; // local hour angle
  const phi = lat * rad;

  const el = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(H));
  return { azimuth: ((az / rad) + 360) % 360, elevation: el / rad };
}
