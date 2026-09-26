import { CONFIG } from './config.js';
import { randomSeed } from './logic/rng.js';
import { getUnit, newGame } from './logic/game.js';
import { createRenderer } from './view/render.js';
import { actionButtons, createInput } from './view/input.js';
import { renderHud } from './view/hud.js';

function readSeed() {
  const v = Number(new URLSearchParams(location.search).get('seed'));
  return Number.isInteger(v) && v > 0 ? v : randomSeed();
}

// localStorage が使えない環境でも止まらないようにする
function loadBest() {
  try {
    return Number(localStorage.getItem(CONFIG.storageKey)) || 1;
  } catch {
    return 1;
  }
}

function saveBest(best) {
  try {
    localStorage.setItem(CONFIG.storageKey, String(best));
  } catch {
    // 保存できなくても遊べればよい
  }
}

const canvas = document.getElementById('map');
const renderer = createRenderer(canvas);
let state = null;
let lastSelectedId = null;
let lastMap = null;

function start(seed) {
  state = newGame(seed, { best: loadBest() });
  lastSelectedId = null;
  lastMap = null;
  renderer.view.overview = false;
}

function refresh() {
  // 階層が変わったとき・選択ユニットが変わったときはカメラを寄せる
  const sel = getUnit(state, state.selectedId);
  if (state.map !== lastMap || state.selectedId !== lastSelectedId) {
    lastMap = state.map;
    lastSelectedId = state.selectedId;
    if (sel) renderer.centerOn(sel.x, sel.y);
  }
  if (state.best > loadBest()) saveBest(state.best);
  renderer.draw(state);
  renderHud(state, actionButtons(state));
}

function restart() {
  const seed = randomSeed();
  try {
    const url = new URL(location.href);
    url.searchParams.set('seed', String(seed));
    history.replaceState(null, '', url);
  } catch {
    // URL を書き換えられなくても続行する
  }
  start(seed);
  refresh();
}

const input = createInput({ canvas, renderer, getState: () => state, refresh, restart });

for (const el of [document.getElementById('actions'), document.getElementById('controls'), document.getElementById('overlay')]) {
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (btn && !btn.disabled) input.handleAction(btn.dataset.action, btn.dataset.arg);
  });
}

start(readSeed());
new ResizeObserver(() => {
  renderer.resize();
  const sel = getUnit(state, state.selectedId);
  if (sel) renderer.centerOn(sel.x, sel.y);
  refresh();
}).observe(canvas);
renderer.resize();
refresh();

// 開発用：?debug を付けると、コンソールから state を触れる
if (new URLSearchParams(location.search).has('debug')) {
  window.dslg = { get state() { return state; }, renderer, input, refresh };
}
