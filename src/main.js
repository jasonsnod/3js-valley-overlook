import { World } from './World.js';

const canvas = document.querySelector('#scene');
const debug = new URLSearchParams(window.location.search).has('debug');

const world = new World(canvas, { debug });
world.start();
