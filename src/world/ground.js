import * as THREE from 'three';

/**
 * Placeholder ground. This will be replaced by real terrain (the valley)
 * once we start shaping the landscape.
 */
export function createGround() {
  const geometry = new THREE.PlaneGeometry(800, 800, 1, 1);
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({
    color: '#6b8f4e',
    roughness: 1,
  });

  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  return ground;
}
