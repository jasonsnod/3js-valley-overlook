import { World } from './World.js';

const canvas = document.querySelector('#scene');
const params = new URLSearchParams(window.location.search);
const debug = params.has('debug');
const startAt = parseFloat(params.get('t')) || 0; // e.g. ?debug&t=30
const pov = params.has('pov'); // debug: view the landscape from the person's eyes

const clearAir = params.has('clearair'); // debug: no haze/fog

const world = new World(canvas, { debug, startAt, pov, clearAir });
world.start(); // renders (black) while the model loads

world
  .build()
  .then(() => {
    // Playback starts once everything is loaded. `?paused` holds it (handy
    // for screenshots and for inspecting a single moment).
    if (!params.has('paused')) world.play();
    document.body.dataset.ready = 'true';
  })
  .catch((err) => console.error('Failed to build world:', err));
