import * as THREE from 'three';

/**
 * Shared look of the air: used by both the sky and the terrain, so distant
 * ridges melt into the horizon with exactly the sky's color.
 *
 * All values linear HDR.
 */
export const ATMOSPHERE = {
  zenith: new THREE.Color(0.09, 0.22, 0.58),
  horizon: new THREE.Color(0.52, 0.62, 0.76), // bluish haze: distant ridges layer in blues
  sunGlow: new THREE.Color(1.0, 0.8, 0.56), // haze lit up around the low sun
  sunColor: new THREE.Color(1.0, 0.82, 0.62).multiplyScalar(3.2), // direct light, warm (low sun)
  skyLight: new THREE.Color(0.38, 0.48, 0.66).multiplyScalar(0.9), // fill from the open sky
  hazeDistance: 11000, // meters for haze to reach ~63%
  // Valley fog: dense below `fogTop` (meters, relative to the viewpoint's
  // ground), thinning quickly above it over `fogFalloff` meters. The top
  // undulates across the landscape by up to ±fogTopVariation.
  fogTop: -88,
  fogFalloff: 6,
  fogTopVariation: 10,
  fogDensity: 1 / 70, // per meter inside the fog
  fogColor: new THREE.Color(0.86, 0.87, 0.88),
};

/** GLSL shared by sky + terrain: in-scattered haze color along a view direction. */
export const atmosphereGLSL = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunGlow;
  uniform vec3 uSunColor;
  uniform vec3 uSkyLight;
  uniform float uHazeDistance;
  uniform float uFogTop;
  uniform float uFogTopVariation;
  uniform float uFogFalloff;
  uniform float uFogDensity;
  uniform vec3 uFogColor;
  uniform float uLevel; // 0 = darkness, 1 = full daylight

  // Color of the air looking along rd (near the horizon).
  vec3 hazeColor(vec3 rd) {
    float s = max(dot(rd, uSunDir), 0.0);
    vec3 c = uHorizon;
    c = mix(c, uSunGlow, pow(s, 16.0) * 0.5);   // broad warm brightening
    c += uSunGlow * pow(s, 200.0) * 0.8;         // tight glow around the disk
    return c;
  }
`;

export function atmosphereUniforms(sunDir) {
  const a = ATMOSPHERE;
  return {
    uSunDir: { value: sunDir.clone() },
    uZenith: { value: a.zenith },
    uHorizon: { value: a.horizon },
    uSunGlow: { value: a.sunGlow },
    uSunColor: { value: a.sunColor },
    uSkyLight: { value: a.skyLight },
    uHazeDistance: { value: a.hazeDistance },
    uFogTop: { value: a.fogTop },
    uFogTopVariation: { value: a.fogTopVariation },
    uFogFalloff: { value: a.fogFalloff },
    uFogDensity: { value: a.fogDensity },
    uFogColor: { value: a.fogColor },
    uLevel: { value: 1 },
  };
}
