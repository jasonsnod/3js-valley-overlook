import * as THREE from 'three';

/**
 * A simple outdoor environment for reflections: morning sky above, a bright
 * hazy horizon, dark forest below. Eyes and skin reflect this, so it needs
 * to read as "outside on a ridge", not a studio. (The sun's own reflection
 * is the catchlight glow, so there's no sun disk here.)
 */
export function createSkyEnvironment(renderer) {
  const scene = new THREE.Scene();
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 zenith  = vec3(0.30, 0.45, 0.75);
        vec3 horizon = vec3(0.85, 0.82, 0.75);
        vec3 ground  = vec3(0.05, 0.065, 0.035);
        vec3 col = y > 0.0
          ? mix(horizon, zenith, pow(y, 0.6))
          : mix(horizon * 0.35, ground, smoothstep(0.0, 0.25, -y));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), material));

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(scene, 0).texture;
  pmrem.dispose();
  material.dispose();
  return texture;
}
