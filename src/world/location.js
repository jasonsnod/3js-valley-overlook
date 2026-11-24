/**
 * The real place and moment the scene is built on. Plain JS (no three.js) so
 * the terrain build tool shares exactly the same numbers.
 *
 * World axes: meters, +Y up, origin on the ground where the person stands.
 * The person faces +Z, which is the real-world compass bearing VIEW_BEARING.
 * (Their right hand points to -X.)
 */
import { sunPosition } from './sun.js';

/** Where the person stands: a trail on a ridge shoulder, southern Ohio. */
export const VIEWPOINT = { lat: 39.208417, lon: -82.743267 }; // 39°12'30.3"N 82°44'35.8"W
/** The point they look toward. */
export const LOOK_TOWARD = { lat: 39.210944, lon: -82.73725 }; // 39°12'39.4"N 82°44'14.1"W

/** A late-summer morning, about an hour after sunrise, fog still in the hollows. */
export const MOMENT = new Date('2026-08-20T08:00:00-04:00');

const R_EARTH = 6371000;
const rad = Math.PI / 180;
export const M_PER_DEG_LAT = 111320;
export const M_PER_DEG_LON = 111320 * Math.cos(VIEWPOINT.lat * rad);

/** Compass bearing (degrees clockwise from north) from VIEWPOINT to LOOK_TOWARD. */
export const VIEW_BEARING = (() => {
  const north = (LOOK_TOWARD.lat - VIEWPOINT.lat) * M_PER_DEG_LAT;
  const east = (LOOK_TOWARD.lon - VIEWPOINT.lon) * M_PER_DEG_LON;
  return ((Math.atan2(east, north) / rad) + 360) % 360;
})();

export const SUN = sunPosition(MOMENT, VIEWPOINT.lat, VIEWPOINT.lon);

/** Ground offset east/north of the viewpoint (meters) → world x/z. */
export function enuToWorld(east, north) {
  const b = VIEW_BEARING * rad;
  const forward = east * Math.sin(b) + north * Math.cos(b);
  const right = east * Math.cos(b) - north * Math.sin(b);
  return { x: -right, z: forward };
}

/** Compass bearing + elevation angle (degrees) → unit world direction. */
export function bearingToWorldDir(bearing, elevation) {
  const c = Math.cos(elevation * rad);
  const { x, z } = enuToWorld(Math.sin(bearing * rad) * c, Math.cos(bearing * rad) * c);
  return { x, y: Math.sin(elevation * rad), z };
}

/** How far the ground drops below a flat plane at distance d (curvature, with typical refraction). */
export const curvatureDrop = (d) => ((d * d) / (2 * R_EARTH)) * (1 - 0.13);
