import * as THREE from 'three';

/**
 * Sky color, fog, and lighting. Fog does a lot of work in landscape scenes —
 * it sells distance and hides where the world ends.
 */
export function createEnvironment(scene) {
  const skyColor = new THREE.Color('#a9c8e8');
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor, 60, 400);

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

  return { hemi, sun };
}
