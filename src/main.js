import { World } from './World.js';

const canvas = document.querySelector('#scene');
const debug = new URLSearchParams(window.location.search).has('debug');

const world = new World(canvas, { debug });
world.start();
world
  .build()
  .then(() => (document.body.dataset.ready = 'true'))
  .catch((err) => console.error('Failed to build world:', err));
