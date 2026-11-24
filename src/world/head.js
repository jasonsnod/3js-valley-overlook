import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyIrisMaterial, IRIS_UV } from './irisMaterial.js';

/**
 * The person. Model: "Angelica" by NikZava284 (CC-BY-4.0), built into
 * public/models/head.glb by `npm run build:head`.
 *
 * World units are meters. The returned group's origin is the midpoint
 * between the two eyeballs, placed at standing eye level, facing +Z.
 */
const INTERPUPILLARY_DISTANCE = 0.063; // meters, adult average
export const EYE_LEVEL = 1.62;

// Brown tint for the hair. The texture is painted near-black, so the factor
// goes above 1 to lift it into a brown.
const HAIR_TINT = new THREE.Color().setRGB(2.1, 1.5, 1.05);

export async function loadHead() {
  const gltf = await new GLTFLoader().loadAsync('/models/head.glb');
  const model = gltf.scene;
  model.updateMatrixWorld(true);

  // Scale from the eyes: the Eye mesh holds both eyeballs, so its width minus
  // one eyeball's diameter (≈ its depth) is the distance between eye centers.
  const eyes = model.getObjectByName('Eye_Eye_0');
  if (!eyes) throw new Error('Eye mesh not found in head model');
  const eyeBox = new THREE.Box3().setFromObject(eyes);
  const eyeSize = eyeBox.getSize(new THREE.Vector3());
  const scale = INTERPUPILLARY_DISTANCE / (eyeSize.x - eyeSize.z);
  const eyeMid = eyeBox.getCenter(new THREE.Vector3());

  model.scale.setScalar(scale);
  model.position.copy(eyeMid).multiplyScalar(-scale);

  const hairMeshes = [];
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    // Shadow maps ignore blended transparency, so see-through layers (lashes,
    // the clear cornea shell, the tear line) would cast solid blocky shadows.
    obj.castShadow = !obj.material.transparent;
    obj.receiveShadow = true;
    if (obj.material.name === 'Hair') hairMeshes.push(obj);
  });
  hairMeshes.forEach(setUpHair);
  applyIrisMaterial(eyes.material);

  const head = new THREE.Group();
  head.name = 'head';
  head.add(model);
  head.userData.eyes = measureEyes(model, eyes);
  head.position.y = EYE_LEVEL;
  return head;
}

/**
 * Per eye, in head space (the person faces +Z, so their right eye is on -X):
 *   center      — eyeball center
 *   radius      — eyeball radius
 *   pupil       — point on the eye surface at the pupil center
 *   irisRadius  — iris radius in meters
 * The pupil is found through the texture layout (UV center of the iris), so
 * it follows the actual gaze direction of the model's eyes.
 */
function measureEyes(model, eyesMesh) {
  model.updateMatrixWorld(true);
  const pos = eyesMesh.geometry.attributes.position;
  const uv = eyesMesh.geometry.attributes.uv;
  const v = new THREE.Vector3();
  const sides = {
    right: { box: new THREE.Box3(), pupil: null, best: Infinity, edge: [] },
    left: { box: new THREE.Box3(), pupil: null, best: Infinity, edge: [] },
  };

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(eyesMesh.matrixWorld);
    const s = sides[v.x < 0 ? 'right' : 'left'];
    s.box.expandByPoint(v);
    const du = Math.hypot(uv.getX(i) - IRIS_UV.center.x, uv.getY(i) - IRIS_UV.center.y);
    if (du < s.best) {
      s.best = du;
      s.pupil = v.clone();
    }
    if (Math.abs(du - IRIS_UV.radius) < 0.01) s.edge.push(v.clone());
  }

  const out = {};
  for (const [side, s] of Object.entries(sides)) {
    const size = s.box.getSize(new THREE.Vector3());
    const radius = size.y / 2; // vertical extent isn't affected by the cornea bulge
    const center = s.box.getCenter(new THREE.Vector3());
    center.z = s.box.max.z - radius;
    const irisRadius = s.edge.length
      ? s.edge.reduce((sum, p) => sum + p.distanceTo(s.pupil), 0) / s.edge.length
      : 0.006;
    out[side] = { center, radius, pupil: s.pupil, irisRadius };
  }
  return out;
}

/**
 * Hair cards are drawn twice: an opaque cut-out pass for the dense strands
 * (writes depth, so no sorting glitches), then a soft blended pass on top for
 * the wispy edges and the fade over the scalp.
 */
function setUpHair(mesh) {
  const solid = mesh.material;
  solid.color.copy(HAIR_TINT);
  solid.opacity = 1;
  // The converted material is quite glossy; on flat hair cards that shows up
  // as blocky highlights. A matte sheen reads more like real hair.
  solid.metalness = 0;
  solid.roughness = 0.65;
  solid.roughnessMap = null;
  solid.metalnessMap = null;
  solid.envMapIntensity = 0.4;
  solid.side = THREE.DoubleSide;
  solid.transparent = false;
  solid.alphaTest = 0.5;

  const soft = solid.clone();
  soft.alphaTest = 0;
  soft.transparent = true;
  soft.depthWrite = false;

  // The solid pass casts shadows (shadow maps honor its alpha cut-out).
  mesh.castShadow = true;
  const softMesh = new THREE.Mesh(mesh.geometry, soft);
  softMesh.receiveShadow = true;
  softMesh.name = `${mesh.name}_soft`;
  softMesh.renderOrder = 1;
  softMesh.position.copy(mesh.position);
  softMesh.quaternion.copy(mesh.quaternion);
  softMesh.scale.copy(mesh.scale);
  mesh.parent.add(softMesh);
}
