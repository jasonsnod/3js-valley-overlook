import * as THREE from 'three';
import { OPENING, catchlightLevel } from './opening.js';
import { lerp, smoothstep, progress } from '../timeline/curves.js';
import { setClipping } from '../core/camera.js';

/**
 * Beat 2 — pull out from the catchlight until the whole face is in frame.
 *
 * One continuous move picking up exactly where the opening's telephoto
 * close-up leaves off. The zoom is paced in log space — each second the
 * frame grows by the same *factor* — so it feels like a steady pull rather
 * than one that races at the end. Light rises out of darkness along the way:
 * first the iris emerges, then the shape of the eye, then the face.
 *
 * All timings are seconds from the start of the piece.
 */
export const PULLOUT = {
  start: OPENING.end, // 30
  end: 75,

  // Final framing: whole face plus hair, a natural portrait lens.
  endFrameHeight: 0.22, // meters of subject visible top-to-bottom
  endFov: 24, // degrees
  faceCenter: new THREE.Vector3(0, -0.03, 0), // head space, just below the eyes

  // Scene light: still dark as the pull begins, fully up before the face
  // is revealed.
  light: { start: 31, end: 62, curve: 1.6 },

  // Catchlight: shrinks from a halo filling the frame to a small, bright,
  // whiter reflection on the cornea.
  glowEndSize: 0.0035, // meters
  glowEndLevel: 0.75,
};

const fovToFrame = (fov, dist) => 2 * dist * Math.tan(THREE.MathUtils.degToRad(fov) / 2);
const frameToDist = (frame, fov) => frame / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2));

export class PullOutBeat {
  constructor({ head, catchlights }) {
    this.catchlights = catchlights;
    this.pupil = catchlights.pupil;
    this.faceCenter = head.localToWorld(PULLOUT.faceCenter.clone());

    this.startFrame = fovToFrame(OPENING.cameraFov, OPENING.cameraDistance);
    this.target = new THREE.Vector3();
  }

  /** 0..1 along the move, eased at both ends. */
  zoom(t) {
    const u = progress(t, PULLOUT.start, PULLOUT.end - PULLOUT.start);
    return u * u * u * (u * (u * 6 - 15) + 10); // smootherstep
  }

  ownsCamera(t) {
    return t >= PULLOUT.start; // holds the final framing until the next beat exists
  }

  poseCamera(camera, t) {
    const z = this.zoom(t);

    // Frame size and lens both change geometrically (log space).
    const frame = Math.exp(lerp(Math.log(this.startFrame), Math.log(PULLOUT.endFrameHeight), z));
    const fov = Math.exp(lerp(Math.log(OPENING.cameraFov), Math.log(PULLOUT.endFov), z));
    const dist = frameToDist(frame, fov);

    // Stay locked on the pupil while the frame is small; drift to the face
    // center only once the frame is big enough that the eye stays in view.
    const drift = smoothstep(0.5, 1.0, z);
    this.target.lerpVectors(this.pupil, this.faceCenter, drift);

    camera.position.copy(this.target).add(new THREE.Vector3(0, 0, dist));
    camera.lookAt(this.target);
    camera.fov = fov;
    setClipping(camera, dist);
    camera.updateProjectionMatrix();
  }

  lightLevel(t) {
    const { start, end, curve } = PULLOUT.light;
    return Math.pow(smoothstep(start, end, t), curve);
  }

  update(t) {
    if (t < PULLOUT.start) return;
    const z = this.zoom(t);
    const size = Math.exp(lerp(Math.log(OPENING.glowSize), Math.log(PULLOUT.glowEndSize), z));
    const level = lerp(catchlightLevel(t), PULLOUT.glowEndLevel, z);
    this.catchlights.set(level, size);
  }
}
