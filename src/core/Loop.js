/**
 * Drives the animation. Anything with an `update(delta, elapsed)` method
 * can be registered via `add()` and will be ticked every frame, then
 * `render()` draws the frame.
 *
 *   delta   — seconds since the previous frame (clamped to avoid big jumps
 *             after the tab was hidden)
 *   elapsed — seconds since the loop started
 */
export class Loop {
  constructor(renderer, render) {
    this.renderer = renderer;
    this.render = render;
    this.updatables = [];
    this.lastTime = null;
    this.elapsed = 0;
  }

  add(updatable) {
    this.updatables.push(updatable);
  }

  remove(updatable) {
    const i = this.updatables.indexOf(updatable);
    if (i !== -1) this.updatables.splice(i, 1);
  }

  start() {
    this.renderer.setAnimationLoop((time) => this.tick(time));
  }

  stop() {
    this.renderer.setAnimationLoop(null);
    this.lastTime = null;
  }

  tick(time) {
    const now = time / 1000;
    const delta = this.lastTime === null ? 0 : Math.min(now - this.lastTime, 0.1);
    this.lastTime = now;
    this.elapsed += delta;

    for (const obj of this.updatables) {
      obj.update(delta, this.elapsed);
    }

    this.render();
  }
}
