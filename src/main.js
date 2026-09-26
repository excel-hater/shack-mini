import { CONFIG } from './config.js';
import { randomSeed } from './logic/rng.js';
import { getUnit, newGame, setOptions } from './logic/game.js';
import { createRenderer } from './view/render.js';
import { actionButtons, createInput } from './view/input.js';
import { renderHud } from './view/hud.js';
import { loadSettings, saveSettings, settingsHtml } from './view/settings.js';

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
const settings = loadSettings();
const logicOptions = () => ({ autoSkipStatue: settings.autoSkipStatue });
let lastSelectedId = null;
let lastMap = null;

function start(seed) {
  state = newGame(seed, { best: loadBest(), options: logicOptions() });
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
  input.syncQuickTargets();
  renderer.draw(state);
  renderHud(state, actionButtons(state), settings);
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

const input = createInput({ canvas, renderer, getState: () => state, getSettings: () => settings, refresh, restart });

// 設定ダイアログ
const settingsEl = document.getElementById('settings');
function openSettings() {
  settingsEl.innerHTML = settingsHtml(settings, state.seed);
  settingsEl.hidden = false;
}
settingsEl.addEventListener('change', (e) => {
  const key = e.target.dataset?.setting;
  if (!key) return;
  settings[key] = e.target.checked;
  saveSettings(settings);
  setOptions(state, logicOptions());
  refresh();
});
settingsEl.addEventListener('click', (e) => {
  // 外側（暗い部分）か「閉じる」で閉じる
  if (e.target === settingsEl || e.target.closest('[data-action="closeSettings"]')) {
    settingsEl.hidden = true;
    refresh();
  }
});
document.getElementById('tb-settings').addEventListener('click', openSettings);

for (const el of ['actions', 'controls', 'overlay', 'panel'].map((id) => document.getElementById(id))) {
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
