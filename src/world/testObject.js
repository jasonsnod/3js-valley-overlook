import * as THREE from 'three';

/**
 * Temporary object to confirm rendering, lighting, shadows, and the
 * animation loop are all wired up. Delete once real scene content exists.
 */
export function createTestObject() {
  const mesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(3, 0),
    new THREE.MeshStandardMaterial({ color: '#d98c4a', flatShading: true }),
  );
  mesh.position.y = 5;
  mesh.castShadow = true;

  mesh.update = (delta, elapsed) => {
    mesh.rotation.y += delta * 0.6;
    mesh.position.y = 5 + Math.sin(elapsed * 1.5) * 0.75;
  };

  return mesh;
}
