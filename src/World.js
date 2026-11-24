import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createRenderer } from './core/renderer.js';
import { createCamera, setClipping } from './core/camera.js';
import { createComposer } from './core/post.js';
import { Loop } from './core/Loop.js';
import { handleResize } from './core/resize.js';

import { Timeline } from './timeline/Timeline.js';
import { OpeningBeat } from './beats/opening.js';
import { PullOutBeat } from './beats/pullout.js';
import { DebugPanel } from './debug/DebugPanel.js';

import { createEnvironment } from './world/environment.js';
import { createSkyEnvironment } from './world/skyEnvironment.js';
import { createSky } from './world/sky.js';
import { loadTerrain } from './world/terrain.js';
import { loadHead, EYE_LEVEL } from './world/head.js';
import { Catchlights, sunDirection } from './world/catchlights.js';

const DURATION = 180; // seconds — the whole piece

/**
 * Owns the renderer/scene/camera, assembles the world, and runs the
 * timeline: each frame the beats pose the scene for `timeline.time`.
 */
export class World {
  constructor(canvas, { debug = false, startAt = 0, pov = false, clearAir = false } = {}) {
    this.debug = debug;
    this.pov = pov;
    this.clearAir = clearAir;
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
    const sunDir = sunDirection(); // the real sun at the real place and moment

    this.env = createEnvironment(this.scene);
    this.env.setLevel(0); // the piece opens in total darkness

    // Outdoor sky for skin and eyes to reflect.
    this.scene.environment = createSkyEnvironment(this.renderer);

    const [head, terrain] = await Promise.all([loadHead(), loadTerrain(sunDir)]);

    this.sky = createSky(sunDir);
    this.terrain = terrain;
    this.scene.add(this.sky, this.terrain);
    this.env.backdropTargets.push(this.sky.material, this.terrain.material);
    if (this.clearAir) {
      // Debug (?clearair): no haze or fog, to inspect the land itself.
      const u = this.terrain.material.uniforms;
      u.uFogDensity.value = 0;
      u.uHazeDistance.value = 1e9;
    }

    this.head = head;
    this.scene.add(this.head);
    this.head.updateMatrixWorld(true);
    const headCenter = this.head.localToWorld(new THREE.Vector3(0, -0.03, -0.04));
    this.env.aimSun(headCenter, sunDir, 0.3);

    this.catchlights = new Catchlights(this.scene, this.head);
    const ctx = { scene: this.scene, head: this.head, catchlights: this.catchlights };
    this.beats.push(new OpeningBeat(ctx), new PullOutBeat(ctx));
  }

  update(delta) {
    this.timeline.update(delta);
    const t = this.timeline.time;

    // Scene lighting comes from the beats (dark until the pull-out). The
    // landscape stays hidden behind the face for now — it's revealed by the
    // move into the person's point of view (not built yet).
    const full = this.forceLights || this.pov;
    const light = Math.max(0, ...this.beats.map((b) => b.lightLevel(t)));
    this.env?.setLevel(full ? 1 : light, full ? 1 : 0);

    if (this.pov && !this.freeCamera) {
      this.posePointOfView();
    } else if (!this.freeCamera) {
      // The first beat that claims the camera at this moment poses it.
      this.beats.find((b) => b.ownsCamera(t))?.poseCamera(this.camera, t);
    }
    for (const beat of this.beats) beat.update(t);
    this.catchlights?.faceCamera(this.camera);

    if (this.controls?.enabled) this.controls.update();
    this.panel?.update();
  }

  /** Debug (?pov): look out through the person's eyes toward the valley. */
  posePointOfView() {
    this.camera.position.set(0, EYE_LEVEL, 0.12);
    this.camera.rotation.set(THREE.MathUtils.degToRad(-3), Math.PI, 0); // face +Z, slightly down
    this.camera.fov = 55;
    setClipping(this.camera, 1000);
    this.camera.updateProjectionMatrix();
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
