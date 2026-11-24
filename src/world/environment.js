import * as THREE from 'three';

/**
 * Lighting for the person (the landscape and sky light themselves — see
 * terrain.js / sky.js — and are faded via `backdropTargets`).
 *
 * `setLevel(light, backdrop)` fades the scene up from total darkness:
 *   light    — 0..1, how lit the subject is (sun, sky fill, reflections)
 *   backdrop — 0..1, how much of the sky/landscape shows (defaults to light)
 *
 * `aimSun(target, direction, extent)` points the sun at a subject and fits
 * its shadow to it, so shadows stay sharp whether the subject is a face or
 * a valley.
 */
export function createEnvironment(scene) {
  scene.background = new THREE.Color(0, 0, 0);
  const backdropTargets = []; // ShaderMaterials with a uLevel uniform

  // Soft fill: sky color from above, earthy bounce from below.
  const hemi = new THREE.HemisphereLight('#cfe3ff', '#4a4632', 0.6);
  scene.add(hemi);

  // Sun — warm, low morning light; the main shadow-casting light.
  const sun = new THREE.DirectionalLight('#ffe7c9', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun);
  scene.add(sun.target);

  const base = { hemi: hemi.intensity, sun: sun.intensity, env: 0.45 };

  function setLevel(light, backdrop = light) {
    hemi.intensity = base.hemi * light;
    sun.intensity = base.sun * light;
    hemi.visible = sun.visible = light > 0;
    scene.environmentIntensity = base.env * light;
    for (const m of backdropTargets) m.uniforms.uLevel.value = backdrop;
  }

  function aimSun(target, direction, extent) {
    sun.target.position.copy(target);
    sun.position.copy(direction).normalize().multiplyScalar(extent * 10).add(target);
    const cam = sun.shadow.camera;
    cam.left = cam.bottom = -extent;
    cam.right = cam.top = extent;
    cam.near = extent * 5;
    cam.far = extent * 15;
    cam.updateProjectionMatrix();
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = extent * 0.004;
  }

  return { hemi, sun, setLevel, aimSun, backdropTargets };
}
