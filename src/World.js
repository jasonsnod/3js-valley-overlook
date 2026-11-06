import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createRenderer } from './core/renderer.js';
import { createCamera } from './core/camera.js';
import { Loop } from './core/Loop.js';
import { handleResize } from './core/resize.js';

import { createEnvironment } from './world/environment.js';
import { createGround } from './world/ground.js';
import { createTestObject } from './world/testObject.js';

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

    // Free-look camera while composing the scene (add ?debug to the URL).
    // The final animation will drive the camera itself.
    if (debug) {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.loop.add({ update: () => this.controls.update() });
      this.scene.add(new THREE.AxesHelper(10));
    }

    this.build();
  }

  build() {
    createEnvironment(this.scene);
    this.scene.add(createGround());

    const testObject = createTestObject();
    this.scene.add(testObject);
    this.loop.add(testObject);
  }

  start() {
    this.loop.start();
  }

  stop() {
    this.loop.stop();
  }
}
