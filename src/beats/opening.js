import * as THREE from 'three';
import { clamp, smoothstep, progress } from '../timeline/curves.js';
import { setClipping } from '../core/camera.js';

/**
 * Beat 1 — darkness, then light pulsing up out of it.
 *
 * The light is the catchlight: the sun reflected on the cornea, up and to
 * one side of the pupil. The camera starts on an extreme telephoto close-up
 * of that spot, so later the pull-out reveals the eye around the light in
 * one continuous shot.
 *
 * All timings are seconds from the start of the piece.
 */
export const OPENING = {
  // Pulses that rise and fall all the way back to black.
  pulses: [
    // Sharp peak (no lingering at full), then winks out fairly quickly.
    { start: 2.0, rise: 1.8, hold: 0.25, fall: 1.3, peak: 0.85, sharp: true },
    { start: 6.85, rise: 1.8, hold: 0.45, fall: 1.8, peak: 1.0 },
  ],
  // The last one rises to full size, then settles back into a smaller,
  // steady glow.
  final: { start: 12.4, rise: 2.0, settleTo: 0.45, settleTime: 3.5 },
  end: 30, // the pull-out begins here (next beat)

  // (The catchlight's position on the cornea is CATCHLIGHT_OFFSET in
  // world/catchlights.js — the sun direction is derived from it.)
  glowSize: 0.016, // world size of the glow quad, meters (larger than the frame)
  cameraDistance: 0.25, // telephoto: far back with a very narrow lens
  cameraFov: 1.4, // degrees → ~6 mm of eye fills the frame height
};

/** How lit the catchlight is at time t (0 = black, ~1 = full). */
export function catchlightLevel(t) {
  let level = 0;

  for (const p of OPENING.pulses) {
    const up = progress(t, p.start, p.rise);
    const down = progress(t, p.start + p.rise + p.hold, p.fall);
    let env;
    if (p.sharp) {
      // Keeps accelerating right up to the peak, and starts dropping the
      // moment it begins to fall, easing only as it reaches black.
      env = Math.pow(up, 1.6) * Math.pow(1 - down, 2);
    } else {
      // Filament-like warm-up, then a soft fade back to black.
      env = Math.pow(smoothstep(0, 1, up), 1.2) * (1 - smoothstep(0, 1, down));
    }
    level = Math.max(level, env * p.peak);
  }

  const f = OPENING.final;
  if (t >= f.start) {
    const up = Math.pow(smoothstep(0, 1, progress(t, f.start, f.rise)), 1.2);
    const after = Math.max(0, t - (f.start + f.rise));
    const settle = f.settleTo + (1 - f.settleTo) * Math.exp(-after / (f.settleTime / 3));
    level = Math.max(level, up * (after > 0 ? settle : 1));
  }

  // A barely-there shimmer so the light feels alive rather than digital.
  // Deterministic in t, so scrubbing always looks the same.
  const shimmer = 1 + 0.025 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.7);
  return clamp(level * shimmer, 0, 2);
}

export class OpeningBeat {
  constructor({ catchlights }) {
    this.catchlights = catchlights;
    this.pupil = catchlights.pupil; // the person's right eye
  }

  /** Is this beat in charge of the camera at time t? */
  ownsCamera(t) {
    return t < OPENING.end;
  }

  poseCamera(camera) {
    camera.position.copy(this.pupil).add(new THREE.Vector3(0, 0, OPENING.cameraDistance));
    camera.lookAt(this.pupil);
    setClipping(camera, OPENING.cameraDistance);
    if (camera.fov !== OPENING.cameraFov) {
      camera.fov = OPENING.cameraFov;
      camera.updateProjectionMatrix();
    }
  }

  /** The scene stays in total darkness; only the catchlight exists. */
  lightLevel() {
    return 0;
  }

  update(t) {
    if (t < OPENING.end) this.catchlights.set(catchlightLevel(t), OPENING.glowSize);
  }
}
