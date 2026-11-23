import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Render pipeline: scene → bloom (bright light spreads like it does in a
 * lens) → tone mapping + color output.
 */
export function createComposer(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // strength, radius, threshold — gentle: a soft lens glow, not a fog.
  const bloom = new UnrealBloomPass(size, 0.55, 0.35, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = (w, h) => {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
  };

  return { composer, bloom, resize };
}
