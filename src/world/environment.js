import * as THREE from 'three';

const SKY = new THREE.Color('#a9c8e8');
const BLACK = new THREE.Color(0, 0, 0);

/**
 * Sky color, fog, and lighting. Fog does a lot of work in landscape scenes —
 * it sells distance and hides where the world ends.
 *
 * `setLevel(0..1)` dims everything together: 0 is total darkness (the
 * opening), 1 is the full daylight scene.
 */
export function createEnvironment(scene) {
  scene.background = SKY.clone();
  scene.fog = new THREE.Fog(SKY.clone(), 60, 400);

  // Soft fill: sky color from above, earthy bounce from below.
  const hemi = new THREE.HemisphereLight('#cfe3ff', '#5a4a3a', 0.8);
  scene.add(hemi);

  // Sun — the main shadow-casting light.
  const sun = new THREE.DirectionalLight('#fff2dd', 2.5);
  sun.position.set(50, 80, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 250;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  const base = { hemi: hemi.intensity, sun: sun.intensity, env: 0.35 };

  function setLevel(level) {
    hemi.intensity = base.hemi * level;
    sun.intensity = base.sun * level;
    hemi.visible = sun.visible = level > 0;
    scene.environmentIntensity = base.env * level;
    scene.background.copy(BLACK).lerp(SKY, level);
    scene.fog.color.copy(scene.background);
  }

  return { hemi, sun, setLevel };
}
