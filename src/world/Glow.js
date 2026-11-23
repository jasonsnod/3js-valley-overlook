import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// A bright core with a soft halo around it. Output is linear HDR (values
// well above 1) so the bloom pass picks it up the way a lens would.
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uCore;
  uniform float uHalo;
  varying vec2 vUv;

  void main() {
    float r = length(vUv - 0.5) * 2.0;           // 0 at center, 1 at quad edge
    float core = exp(-pow(r / uCore, 2.0));
    float halo = pow(1.0 + pow(r / uHalo, 2.0), -1.5);
    float edge = 1.0 - smoothstep(0.6, 1.0, r);   // fade out before the quad edge
    vec3 col = uColor * (core * 8.0 + halo * 0.35) * uIntensity * edge;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const WARM = new THREE.Color(1.0, 0.42, 0.14); // a filament just starting to glow
const HOT = new THREE.Color(1.0, 0.93, 0.84); // full, slightly warm white

/**
 * A point of light that always faces the camera. `level` (0..1+) controls
 * brightness, size and colour together: dim light is small and amber,
 * bright light is larger and whiter.
 */
export class Glow extends THREE.Mesh {
  constructor(size) {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color() },
        uIntensity: { value: 0 },
        uCore: { value: 0.05 },
        uHalo: { value: 0.1 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      // It's a reflection on the cornea surface: never let the lids or
      // lashes clip its halo.
      depthTest: false,
    });
    super(new THREE.PlaneGeometry(1, 1), material);
    this.scale.setScalar(size);
    this.renderOrder = 10;
    this.frustumCulled = false;
    this.setLevel(0);
  }

  setLevel(level) {
    const u = this.material.uniforms;
    const warmth = THREE.MathUtils.smoothstep(level, 0.0, 0.9);
    u.uColor.value.copy(WARM).lerp(HOT, warmth);
    u.uIntensity.value = level;
    // Swells as it brightens; at full level the light fills much of the frame.
    const l = Math.min(level, 1);
    u.uCore.value = 0.02 + 0.07 * l * l;
    u.uHalo.value = 0.03 + 0.17 * l * l;
    this.visible = level > 0.0005;
  }

  faceCamera(camera) {
    this.quaternion.copy(camera.quaternion);
  }
}
