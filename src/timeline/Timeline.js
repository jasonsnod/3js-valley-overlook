/**
 * The master clock for the animation. Every beat reads `timeline.time`
 * (seconds from the start of the piece) and poses the scene for that moment,
 * so the whole piece can be scrubbed to any point and look the same as when
 * played through.
 */
export class Timeline {
  constructor({ duration }) {
    this.duration = duration;
    this.time = 0;
    this.speed = 1;
    this.playing = false;
  }

  update(delta) {
    if (!this.playing) return;
    this.time = Math.min(this.duration, this.time + delta * this.speed);
    if (this.time >= this.duration) this.playing = false;
  }

  play() {
    if (this.time >= this.duration) this.time = 0;
    this.playing = true;
  }

  pause() {
    this.playing = false;
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  seek(t) {
    this.time = Math.min(this.duration, Math.max(0, t));
  }
}
