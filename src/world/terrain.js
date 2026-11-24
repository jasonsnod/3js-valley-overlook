import * as THREE from 'three';
import { enuToWorld, curvatureDrop } from './location.js';
import { atmosphereGLSL, atmosphereUniforms } from './atmosphere.js';

/**
 * The real landscape around the viewpoint (built by `npm run build:terrain`),
 * as a polar mesh centered on the person: rings of points spaced closer near
 * the middle, so detail is spent where the eye can see it.
 *
 * Lighting, haze and valley fog are done in its own shader so the distant
 * land behaves like real air and light at that scale (and isn't affected by
 * the lights fitted to the face).
 */
export async function loadTerrain(sunDir) {
  const [meta, buffer] = await Promise.all([
    fetch('/terrain/terrain.json').then((r) => r.json()),
    fetch('/terrain/terrain.bin').then((r) => r.arrayBuffer()),
  ]);
  const { rays, rings, rMin, rMax } = meta;
  const count = rays * rings;
  const heights = new Float32Array(buffer, 0, count);
  const field = new Uint8Array(buffer, count * 4, count);
  const sun = new Uint8Array(buffer, count * 5, count);
  const sky = new Uint8Array(buffer, count * 6, count);

  const positions = new Float32Array(count * 3);
  for (let j = 0; j < rings; j++) {
    const r = rMin * (rMax / rMin) ** (j / (rings - 1));
    const drop = curvatureDrop(r);
    for (let k = 0; k < rays; k++) {
      const b = (k / rays) * 2 * Math.PI;
      const { x, z } = enuToWorld(r * Math.sin(b), r * Math.cos(b));
      const i = j * rays + k;
      positions[i * 3] = x;
      positions[i * 3 + 1] = heights[i] - drop;
      positions[i * 3 + 2] = z;
    }
  }

  const indices = new Uint32Array((rings - 1) * rays * 6);
  let p = 0;
  for (let j = 0; j < rings - 1; j++) {
    for (let k = 0; k < rays; k++) {
      const a = j * rays + k;
      const b = j * rays + ((k + 1) % rays);
      const c = a + rays;
      const d = b + rays;
      indices.set([a, c, b, b, c, d], p);
      p += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aField', new THREE.BufferAttribute(field, 1, true));
  geometry.setAttribute('aSun', new THREE.BufferAttribute(sun, 1, true));
  geometry.setAttribute('aSky', new THREE.BufferAttribute(sky, 1, true));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  // The ray order (compass bearings) mirrors into world space, which can flip
  // the triangle winding. If faces point down, reverse every triangle so
  // they face the sky (and aren't culled as back faces).
  const nrm = geometry.attributes.normal;
  let up = 0;
  for (let i = 0; i < nrm.count; i += 97) up += nrm.getY(i);
  if (up < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const t = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = t;
    }
    geometry.index.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    uniforms: atmosphereUniforms(sunDir),
    vertexShader,
    fragmentShader,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'terrain';
  mesh.frustumCulled = false;
  mesh.userData.attribution = meta.attribution;
  return mesh;
}

const vertexShader = /* glsl */ `
  attribute float aField;
  attribute float aSun;
  attribute float aSky;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vField;
  varying float vSun;
  varying float vSky;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vField = aField;
    vSun = aSun;
    vSky = aSky;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const fragmentShader = /* glsl */ `
  ${atmosphereGLSL}
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vField;
  varying float vSun;
  varying float vSky;

  float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float tNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(tHash(i), tHash(i + vec2(1, 0)), f.x),
               mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), f.x), f.y);
  }
  float tFbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * tNoise(p); p *= 2.07; a *= 0.5; }
    return s;
  }

  // Optical depth of the valley fog along a ray (exponential height fog,
  // integrated analytically). Heights are relative to the fog top.
  float fogDepth(vec3 ro, vec3 rd, float dist, float top) {
    float b = 1.0 / uFogFalloff;
    float a = uFogDensity;
    float y0 = ro.y - top;
    float dy = rd.y;
    float start = a * exp(-b * y0);
    if (abs(dy) < 1e-4) return start * dist;
    return start * (1.0 - exp(-b * dy * dist)) / (b * dy);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 toCam = cameraPosition - vWorld;
    float dist = length(toCam);
    vec3 rd = -toCam / dist; // camera → point

    // ---- surface
    // Late-summer forest: deep greens with patchy variation between stands,
    // a hint of early yellowing. Fields: lighter, drier green.
    float stand = tFbm(vWorld.xz / 180.0);
    vec3 forest = mix(vec3(0.020, 0.038, 0.014), vec3(0.040, 0.055, 0.018), stand);
    forest = mix(forest, vec3(0.055, 0.055, 0.020), smoothstep(0.62, 0.8, tFbm(vWorld.xz / 400.0 + 7.0)) * 0.5);
    // Fields: mostly green crops and hay, the odd mown golden one.
    float fieldKind = tNoise(vWorld.xz / 140.0);
    vec3 meadow = mix(vec3(0.045, 0.075, 0.022), vec3(0.065, 0.09, 0.03), tFbm(vWorld.xz / 40.0));
    meadow = mix(meadow, vec3(0.11, 0.095, 0.04), smoothstep(0.68, 0.75, fieldKind));
    float fieldMask = smoothstep(0.35, 0.75, vField + (tNoise(vWorld.xz / 90.0) - 0.5) * 0.3);
    vec3 albedo = mix(forest, meadow, fieldMask);

    // Tree crowns: bumpy canopy texture, faded out with distance before it
    // would shimmer.
    float crownScale = 7.0;
    float crowns = tFbm(vWorld.xz / crownScale);
    float crownFade = 1.0 - smoothstep(0.5, 1.5, fwidth(vWorld.x) / crownScale + fwidth(vWorld.z) / crownScale);
    albedo *= mix(1.0, 0.55 + 0.9 * crowns, crownFade * (1.0 - fieldMask));

    // ---- light
    float ndl = max(dot(n, uSunDir), 0.0);
    // Forest canopy scatters light even on slopes facing away a little.
    float wrap = max((dot(n, uSunDir) + 0.25) / 1.25, 0.0);
    float direct = mix(wrap, ndl, fieldMask) * vSun;
    vec3 col = albedo * (uSunColor * direct + uSkyLight * (0.25 + 0.75 * vSky) * (0.6 + 0.4 * n.y));

    // ---- air
    float haze = 1.0 - exp(-dist / uHazeDistance);
    // The fog top rises and dips across the landscape so it reads as a
    // living layer rather than a flat line.
    float top = uFogTop + (tFbm(vWorld.xz / 700.0) - 0.5) * 2.0 * uFogTopVariation;
    float fog = 1.0 - exp(-fogDepth(cameraPosition, rd, dist, top));
    vec3 hc = hazeColor(rd);
    // Fog is lit by the low sun: brighter looking toward it.
    float s = max(dot(rd, uSunDir), 0.0);
    vec3 fc = uFogColor * (0.9 + 0.8 * pow(s, 4.0)) + uSunGlow * pow(s, 20.0) * 0.6;
    col = mix(col, hc, haze);
    col = mix(col, fc, fog);

    gl_FragColor = vec4(col * uLevel, 1.0);
  }
`;
