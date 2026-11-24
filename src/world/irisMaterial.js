import * as THREE from 'three';

/**
 * Replaces the model's low-resolution (256px, blue-grey) iris with a brown
 * iris generated on the GPU, so it stays sharp even millimeters from the
 * camera. The sclera (white of the eye) still comes from the model's texture.
 *
 * Measured from the model's eye texture: the pupil is centered at UV
 * (0.5, 0.5) and the iris edge is ~0.137 UV units from the center.
 */
export const IRIS_UV = { center: new THREE.Vector2(0.5, 0.5), radius: 0.137 };
const PUPIL = 0.36; // pupil radius as a fraction of iris radius (bright daylight)

const noiseGLSL = /* glsl */ `
  float irisHash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float irisNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(irisHash(i + vec3(0,0,0)), irisHash(i + vec3(1,0,0)), f.x),
          mix(irisHash(i + vec3(0,1,0)), irisHash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(irisHash(i + vec3(0,0,1)), irisHash(i + vec3(1,0,1)), f.x),
          mix(irisHash(i + vec3(0,1,1)), irisHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float irisFbm(vec3 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += a * irisNoise(p); p *= 2.03; a *= 0.5; }
    return s;
  }
`;

// Linear-space colors. Noise is sampled using the direction vector (not the
// angle) so there is no seam where the angle wraps around.
const irisGLSL = /* glsl */ `
  uniform vec2 uIrisCenter;
  uniform float uIrisRadius;
  uniform float uPupil;

  vec3 irisColor(vec2 uv, vec3 scleraCol, out float mask) {
    vec2 d = (uv - uIrisCenter) / uIrisRadius;
    float r = length(d);
    vec2 dir = d / max(r, 1e-5);

    float p = uPupil + 0.012 * (irisNoise(vec3(dir * 8.0, 4.0)) - 0.5);
    float t = clamp((r - p) / (1.0 - p), 0.0, 1.0); // 0 at pupil edge, 1 at limbus

    vec3 amber = vec3(0.17, 0.085, 0.03);
    vec3 brown = vec3(0.085, 0.040, 0.016);
    vec3 dark  = vec3(0.028, 0.012, 0.005);

    // Collarette: the irregular ring dividing the lighter inner zone from
    // the outer. Kept subtle — in brown eyes it's a shift in tone, not a band.
    float colR = 0.33 + 0.12 * (irisFbm(vec3(dir * 5.0, 1.7)) - 0.5) * 2.0;
    float inner = 1.0 - smoothstep(colR - 0.08, colR + 0.06, t);
    vec3 c = mix(brown, amber, inner * 0.6 * (0.6 + 0.8 * irisFbm(vec3(dir * 14.0, 2.9))));

    // Radial fibres: coarse streaks plus fine threads.
    float fib = irisFbm(vec3(dir * 38.0, t * 2.5));
    float fine = irisNoise(vec3(dir * 150.0, t * 7.0));
    c *= 0.55 + 0.9 * fib;
    c *= 0.82 + 0.36 * fine;

    // Raised ridge of the collarette catches a little light.
    c += vec3(0.03, 0.017, 0.006) * exp(-pow((t - colR) / 0.03, 2.0)) * irisFbm(vec3(dir * 20.0, 5.0));

    // Crypts: small dark pits scattered through both zones.
    float crypt = smoothstep(0.58, 0.72, irisFbm(vec3(dir * 9.0, t * 4.0 + 3.1)));
    c = mix(c, dark, crypt * 0.7 * smoothstep(0.05, 0.2, t) * (1.0 - smoothstep(0.8, 0.92, t)));

    // Faint concentric contraction furrows in the outer zone.
    float furrow = 0.5 + 0.5 * sin(t * 55.0 + irisFbm(vec3(dir * 5.0, 0.0)) * 6.0);
    c *= 1.0 - 0.16 * smoothstep(0.5, 0.6, t) * smoothstep(0.6, 1.0, furrow);

    // Dark pupillary ruff hugging the pupil.
    c = mix(c, vec3(0.035, 0.016, 0.007), 1.0 - smoothstep(0.0, 0.06, t));

    // Limbal ring: the iris darkens toward its outer edge.
    c = mix(c, dark * 0.6, smoothstep(0.78, 1.0, t));

    // Pupil.
    c = mix(c, vec3(0.003), 1.0 - smoothstep(p - 0.015, p + 0.008, r));

    // Soft transition into the sclera, then hand back to the model's texture.
    c = mix(c, scleraCol, smoothstep(1.0, 1.1, r));
    mask = 1.0 - smoothstep(1.1, 1.16, r);
    return c;
  }
`;

export function applyIrisMaterial(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uIrisCenter = { value: IRIS_UV.center };
    shader.uniforms.uIrisRadius = { value: IRIS_UV.radius };
    shader.uniforms.uPupil = { value: PUPIL };

    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${noiseGLSL}\n${irisGLSL}\nvoid main() {`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `
        #ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv );
          vec2 irisDir = normalize(vMapUv - uIrisCenter + 1e-6);
          vec3 scleraCol = texture2D( map, uIrisCenter + irisDir * uIrisRadius * 1.3 ).rgb;
          float irisMask;
          vec3 irisCol = irisColor( vMapUv, scleraCol, irisMask );
          diffuseColor.rgb *= mix( sampledDiffuseColor.rgb, irisCol, irisMask );
        #endif
        `,
      );
  };
  material.customProgramCacheKey = () => 'procedural-iris-v2';
  material.needsUpdate = true;
}
