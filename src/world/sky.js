import * as THREE from 'three';
import { atmosphereGLSL, atmosphereUniforms } from './atmosphere.js';

/**
 * Morning sky dome: deep blue overhead, pale hazy horizon, a warm glow
 * around the low sun, and the sun disk itself (bright enough to bloom).
 */
export function createSky(sunDir) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: atmosphereUniforms(sunDir),
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww; // always at the far plane
      }
    `,
    fragmentShader: /* glsl */ `
      ${atmosphereGLSL}
      varying vec3 vDir;
      void main() {
        vec3 rd = normalize(vDir);
        float up = max(rd.y, 0.0);
        vec3 col = mix(hazeColor(rd), uZenith, pow(up, 0.5));
        // a little glow above the haze band around the sun
        float s = max(dot(rd, uSunDir), 0.0);
        col += uSunGlow * pow(s, 30.0) * 0.25 * (1.0 - up);
        // below the horizon (only seen past the edge of the terrain)
        col = mix(col, hazeColor(rd) * 0.8, smoothstep(0.0, -0.05, rd.y));
        // sun disk (~0.53° across) with a soft edge
        float disk = smoothstep(cos(0.32 * 0.01745), cos(0.25 * 0.01745), s);
        col += vec3(1.0, 0.92, 0.8) * disk * 12.0;
        gl_FragColor = vec4(col * uLevel, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), material);
  sky.scale.setScalar(30000);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  sky.name = 'sky';
  return sky;
}
