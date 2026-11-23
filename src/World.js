import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { createRenderer } from './core/renderer.js';
import { createCamera } from './core/camera.js';
import { Loop } from './core/Loop.js';
import { handleResize } from './core/resize.js';

import { createEnvironment } from './world/environment.js';
import { createGround } from './world/ground.js';
import { loadHead, EYE_LEVEL } from './world/head.js';

/**
 * Owns the renderer/scene/camera and assembles everything in the world.
 * New scene elements get created in `build()` and, if animated, added
 * to the loop.
 */
export class World {
  constructor(canvas, { debug = false } = {}) {
    this.renderer = createRenderer(canvas);
    this.scene = new THREE.Scene();
    this.camera = createCamera();
    this.loop = new Loop(this.renderer, this.scene, this.camera);

    handleResize(this.renderer, this.camera);

    // Temporary framing on the face until the timeline drives the camera.
    this.camera.position.set(0.08, EYE_LEVEL + 0.01, 0.5);
    this.camera.lookAt(0, EYE_LEVEL - 0.035, 0);

    // Free-look camera while composing the scene (add ?debug to the URL).
    // The final animation will drive the camera itself.
    if (debug) {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.target.set(0, EYE_LEVEL - 0.035, 0);
      this.controls.enableDamping = true;
      this.loop.add({ update: () => this.controls.update() });
    }
  }

  async build() {
    createEnvironment(this.scene);
    this.scene.add(createGround());

    // Soft image-based light so skin and eyes have something to reflect.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    this.head = await loadHead();
    this.scene.add(this.head);
  }

  start() {
    this.loop.start();
  }

  stop() {
    this.loop.stop();
  }
}
