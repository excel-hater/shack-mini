import { randomSeed } from './logic/rng.js';
import { newGame } from './logic/game.js';
import { createRenderer } from './view/render.js';
import { createInput } from './view/input.js';

function readSeed() {
  const v = Number(new URLSearchParams(location.search).get('seed'));
  return Number.isInteger(v) && v > 0 ? v : randomSeed();
}

const canvas = document.getElementById('map');
const renderer = createRenderer(canvas);
let state = newGame(readSeed());

function refresh() {
  renderer.draw(state);
  document.getElementById('tb-floor').textContent = `${state.floor}階`;
  document.getElementById('tb-turn').textContent = `ターン ${state.floorTurn}`;
  document.getElementById('tb-best').textContent = `ベスト ${state.best}階`;
  document.getElementById('tb-seed').textContent = `seed ${state.seed}`;
}

const input = createInput({ canvas, renderer, getState: () => state, refresh });

document.getElementById('controls').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (btn && !btn.disabled) input.handleAction(btn.dataset.action);
});

new ResizeObserver(() => { renderer.resize(); refresh(); }).observe(canvas);
renderer.resize();
renderer.centerOn(state.map.w / 2, state.map.h / 2);
refresh();
