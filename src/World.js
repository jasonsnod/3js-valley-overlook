import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { createRenderer } from './core/renderer.js';
import { createCamera } from './core/camera.js';
import { createComposer } from './core/post.js';
import { Loop } from './core/Loop.js';
import { handleResize } from './core/resize.js';

import { Timeline } from './timeline/Timeline.js';
import { OpeningBeat } from './beats/opening.js';
import { DebugPanel } from './debug/DebugPanel.js';

import { createEnvironment } from './world/environment.js';
import { createGround } from './world/ground.js';
import { loadHead } from './world/head.js';

const DURATION = 180; // seconds — the whole piece

/**
 * Owns the renderer/scene/camera, assembles the world, and runs the
 * timeline: each frame the beats pose the scene for `timeline.time`.
 */
export class World {
  constructor(canvas, { debug = false, startAt = 0 } = {}) {
    this.debug = debug;
    this.renderer = createRenderer(canvas);
    this.scene = new THREE.Scene();
    this.camera = createCamera();

    const post = createComposer(this.renderer, this.scene, this.camera);
    this.composer = post.composer;
    this.loop = new Loop(this.renderer, () => this.composer.render());
    handleResize(this.renderer, this.camera, post.resize);

    this.timeline = new Timeline({ duration: DURATION });
    this.timeline.seek(startAt);
    this.beats = [];
    this.freeCamera = false;
    this.forceLights = false;

    if (debug) {
      this.controls = new OrbitControls(this.camera, canvas);
      this.controls.enableDamping = true;
      this.controls.enabled = false;
      this.panel = new DebugPanel(this.timeline, {
        onFreeCamera: (on) => this.setFreeCamera(on),
        onLights: (on) => (this.forceLights = on),
      });
    }

    this.loop.add({ update: (delta) => this.update(delta) });
  }

  async build() {
    this.env = createEnvironment(this.scene);
    this.env.setLevel(0); // the piece opens in total darkness
    this.scene.add(createGround());

    // Soft image-based light so skin and eyes have something to reflect.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envMap;

    this.head = await loadHead();
    this.scene.add(this.head);
    this.head.updateMatrixWorld(true);

    this.beats.push(new OpeningBeat({ scene: this.scene, head: this.head }));
  }

  update(delta) {
    this.timeline.update(delta);
    const t = this.timeline.time;

    // Scene lighting: dark for the opening. Later beats will raise this.
    this.env?.setLevel(this.forceLights ? 1 : 0);

    // The first beat that claims the camera at this moment poses it.
    if (!this.freeCamera) {
      this.beats.find((b) => b.ownsCamera(t))?.poseCamera(this.camera);
    }
    for (const beat of this.beats) beat.update(t, this.camera);

    if (this.controls?.enabled) this.controls.update();
    this.panel?.update();
  }

  setFreeCamera(on) {
    this.freeCamera = on;
    if (!this.controls) return;
    this.controls.enabled = on;
    if (on) {
      // Start orbiting from where the timeline camera is, at a normal lens.
      const target = new THREE.Vector3();
      this.camera.getWorldDirection(target).multiplyScalar(0.3).add(this.camera.position);
      this.controls.target.copy(target);
      this.camera.fov = 50;
      this.camera.updateProjectionMatrix();
    }
  }

  start() {
    this.loop.start();
  }

  play() {
    this.timeline.play();
  }
}
