/**
 * Playback controls shown with ?debug.
 *
 *   Space         play / pause
 *   ← / →         back / forward 1 s   (Shift: 5 s)
 *   Home          jump to start
 *   F             toggle free camera (orbit with the mouse)
 *   L             toggle scene lights (see the set while it's dark)
 */
export class DebugPanel {
  constructor(timeline, { onFreeCamera, onLights }) {
    this.timeline = timeline;
    this.state = { freeCamera: false, lights: false };

    const el = document.createElement('div');
    el.className = 'debug-panel';
    el.innerHTML = `
      <button data-act="play" title="Space">▶</button>
      <input data-act="scrub" type="range" min="0" max="${timeline.duration}" step="0.05" value="0" />
      <span data-act="time">0:00.0</span>
      <select data-act="speed" title="Playback speed">
        <option value="0.25">¼×</option>
        <option value="1" selected>1×</option>
        <option value="2">2×</option>
        <option value="4">4×</option>
      </select>
      <label title="F"><input data-act="free" type="checkbox" /> free cam</label>
      <label title="L"><input data-act="lights" type="checkbox" /> lights</label>
    `;
    document.body.appendChild(el);

    const $ = (name) => el.querySelector(`[data-act="${name}"]`);
    this.playBtn = $('play');
    this.scrub = $('scrub');
    this.timeLabel = $('time');
    const freeBox = $('free');
    const lightsBox = $('lights');

    this.playBtn.addEventListener('click', () => timeline.toggle());
    this.scrub.addEventListener('input', () => timeline.seek(parseFloat(this.scrub.value)));
    $('speed').addEventListener('change', (e) => (timeline.speed = parseFloat(e.target.value)));

    const setFree = (v) => {
      this.state.freeCamera = freeBox.checked = v;
      onFreeCamera(v);
    };
    const setLights = (v) => {
      this.state.lights = lightsBox.checked = v;
      onLights(v);
    };
    freeBox.addEventListener('change', () => setFree(freeBox.checked));
    lightsBox.addEventListener('change', () => setLights(lightsBox.checked));

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
      const step = e.shiftKey ? 5 : 1;
      switch (e.code) {
        case 'Space': timeline.toggle(); break;
        case 'ArrowLeft': timeline.seek(timeline.time - step); break;
        case 'ArrowRight': timeline.seek(timeline.time + step); break;
        case 'Home': timeline.seek(0); break;
        case 'KeyF': setFree(!this.state.freeCamera); break;
        case 'KeyL': setLights(!this.state.lights); break;
        default: return;
      }
      e.preventDefault();
    });
  }

  update() {
    const t = this.timeline.time;
    this.playBtn.textContent = this.timeline.playing ? '❚❚' : '▶';
    if (document.activeElement !== this.scrub) this.scrub.value = t;
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1).padStart(4, '0');
    this.timeLabel.textContent = `${m}:${s}`;
  }
}
