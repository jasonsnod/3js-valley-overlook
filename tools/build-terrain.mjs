/**
 * Builds public/terrain/terrain.bin + terrain.json: the real landscape around
 * the viewpoint, sampled on a polar grid centered on the person (dense close
 * by, coarser with distance — the camera never leaves this spot, so detail is
 * spent where it shows).
 *
 *   npm run build:terrain
 *
 * Elevation: AWS Open Data "Terrain Tiles" (Terrarium encoding), which in the
 * US come from USGS 3DEP. Tiles are cached in assets-src/terrain/cache.
 *
 * Per vertex it also bakes, from the real terrain:
 *   field  — likelihood of open field/meadow (flat ground on a valley floor)
 *   sun    — direct sunlight at the scene's moment (ridge shadows)
 *   sky    — how open the sky is (deep hollows get less)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { VIEWPOINT, SUN, VIEW_BEARING, MOMENT, M_PER_DEG_LAT, M_PER_DEG_LON } from '../src/world/location.js';

const RAYS = 1024; // around the full circle
const RINGS = 320; // from R_MIN to R_MAX, spaced geometrically
const R_MIN = 12;
const R_MAX = 15000;
const NEAR_Z = 14, NEAR_RADIUS = 4500; // ~7.4 m/px
const FAR_Z = 13, FAR_RADIUS = 17000; // ~14.8 m/px

const CACHE = 'assets-src/terrain/cache';
const OUT_DIR = 'public/terrain';
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------- tiles
async function loadGrid(z, radius) {
  const n = 2 ** z;
  const lonToX = (lon) => ((lon + 180) / 360) * n;
  const latToY = (lat) => {
    const r = (lat * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  };
  const dLat = radius / M_PER_DEG_LAT, dLon = radius / M_PER_DEG_LON;
  const x0 = Math.floor(lonToX(VIEWPOINT.lon - dLon)), x1 = Math.floor(lonToX(VIEWPOINT.lon + dLon));
  const y0 = Math.floor(latToY(VIEWPOINT.lat + dLat)), y1 = Math.floor(latToY(VIEWPOINT.lat - dLat));
  const W = (x1 - x0 + 1) * 256, H = (y1 - y0 + 1) * 256;
  const elev = new Float32Array(W * H);

  let fetched = 0;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const file = path.join(CACHE, `${z}_${tx}_${ty}.png`);
      if (!fs.existsSync(file)) {
        const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${tx}/${ty}.png`);
        if (!res.ok) throw new Error(`tile z${z} ${tx},${ty}: HTTP ${res.status}`);
        fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
        fetched++;
      }
      const { data } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let py = 0; py < 256; py++) {
        for (let px = 0; px < 256; px++) {
          const i = (py * 256 + px) * 3;
          elev[((ty - y0) * 256 + py) * W + (tx - x0) * 256 + px] = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
        }
      }
    }
  }
  console.log(`z${z}: ${(x1 - x0 + 1) * (y1 - y0 + 1)} tiles (${fetched} downloaded)`);

  const cx = (lonToX(VIEWPOINT.lon) - x0) * 256;
  const cy = (latToY(VIEWPOINT.lat) - y0) * 256;
  const mPerPx = (40075016.686 * Math.cos((VIEWPOINT.lat * Math.PI) / 180)) / (n * 256);

  // elevation at a ground offset (meters east/north of the viewpoint)
  return (east, north) => {
    const px = cx + east / mPerPx, py = cy - north / mPerPx;
    const ix = Math.floor(px), iy = Math.floor(py);
    if (ix < 0 || iy < 0 || ix >= W - 1 || iy >= H - 1) return NaN;
    const fx = px - ix, fy = py - iy;
    const a = elev[iy * W + ix], b = elev[iy * W + ix + 1];
    const c = elev[(iy + 1) * W + ix], d = elev[(iy + 1) * W + ix + 1];
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  };
}

const near = await loadGrid(NEAR_Z, NEAR_RADIUS);
const far = await loadGrid(FAR_Z, FAR_RADIUS);
const elevAt = (e, n) => {
  const d = Math.hypot(e, n);
  if (d < NEAR_RADIUS - 200) return near(e, n);
  const f = far(e, n);
  if (d > NEAR_RADIUS) return f;
  const t = (d - (NEAR_RADIUS - 200)) / 200; // blend across the seam
  return near(e, n) * (1 - t) + f * t;
};

const e0 = elevAt(0, 0);
console.log(`viewpoint ground elevation ${e0.toFixed(1)} m; facing ${VIEW_BEARING.toFixed(1)}°; sun az ${SUN.azimuth.toFixed(1)}° el ${SUN.elevation.toFixed(1)}° at ${MOMENT.toISOString()}`);

// ---------------------------------------------------------------- bake
const rad = Math.PI / 180;
const sunE = Math.sin(SUN.azimuth * rad), sunN = Math.cos(SUN.azimuth * rad);
const sunTan = Math.tan(SUN.elevation * rad);

const count = RAYS * RINGS;
const heights = new Float32Array(count);
const field = new Uint8Array(count);
const sunVis = new Uint8Array(count);
const skyVis = new Uint8Array(count);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

const t0 = Date.now();
for (let j = 0; j < RINGS; j++) {
  const r = R_MIN * (R_MAX / R_MIN) ** (j / (RINGS - 1));
  for (let k = 0; k < RAYS; k++) {
    const b = (k / RAYS) * 360 * rad;
    const e = r * Math.sin(b), n = r * Math.cos(b);
    const h = elevAt(e, n);
    const i = j * RAYS + k;
    heights[i] = h - e0;

    // Slope (degrees) from a 15 m central difference.
    const gx = (elevAt(e + 15, n) - elevAt(e - 15, n)) / 30;
    const gy = (elevAt(e, n + 15) - elevAt(e, n - 15)) / 30;
    const slope = Math.atan(Math.hypot(gx, gy)) / rad;

    // Height above the lowest ground nearby → valley floor vs. hillside.
    let lowest = h, horizonSum = 0;
    for (let a = 0; a < 8; a++) {
      const ae = Math.sin((a / 8) * 2 * Math.PI), an = Math.cos((a / 8) * 2 * Math.PI);
      let maxAng = 0;
      for (const d of [60, 150, 300, 500]) {
        const hh = elevAt(e + ae * d, n + an * d);
        if (Number.isNaN(hh)) continue;
        lowest = Math.min(lowest, hh);
        maxAng = Math.max(maxAng, Math.atan2(hh - h, d));
      }
      horizonSum += Math.sin(maxAng);
    }
    const flat = 1 - smooth(3, 7, slope);
    const low = 1 - smooth(6, 16, h - lowest);
    field[i] = Math.round(255 * flat * low);
    skyVis[i] = Math.round(255 * (1 - Math.min(1, horizonSum / 8) * 1.4));

    // March toward the sun: is a ridge in the way?
    let excess = -Infinity;
    for (let d = 20; d < 5000; d *= 1.06) {
      const hh = elevAt(e + sunE * d, n + sunN * d);
      if (Number.isNaN(hh)) break;
      excess = Math.max(excess, hh - (h + 3 + d * sunTan));
    }
    sunVis[i] = Math.round(255 * (1 - smooth(-6, 6, excess)));
  }
  if (j % 40 === 0) process.stdout.write(`  ring ${j}/${RINGS}\r`);
}
console.log(`baked ${count} vertices in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

// ---------------------------------------------------------------- write
const buf = Buffer.concat([
  Buffer.from(heights.buffer),
  Buffer.from(field.buffer),
  Buffer.from(sunVis.buffer),
  Buffer.from(skyVis.buffer),
]);
fs.writeFileSync(path.join(OUT_DIR, 'terrain.bin'), buf);
fs.writeFileSync(
  path.join(OUT_DIR, 'terrain.json'),
  JSON.stringify(
    {
      rays: RAYS, rings: RINGS, rMin: R_MIN, rMax: R_MAX,
      layout: ['heights:f32', 'field:u8', 'sun:u8', 'sky:u8'],
      viewpoint: VIEWPOINT, groundElevation: e0,
      attribution: 'Elevation: Terrain Tiles (AWS Open Data), from USGS 3DEP',
    },
    null,
    2,
  ),
);
console.log(`wrote ${OUT_DIR}/terrain.bin (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
