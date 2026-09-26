import { CONFIG } from './config.js';
import { randomSeed } from './logic/rng.js';
import { getUnit, newGame, setOptions } from './logic/game.js';
import { createRenderer } from './view/render.js';
import { actionButtons, createInput } from './view/input.js';
import { renderHud, toggleLog } from './view/hud.js';
import { createFx } from './view/fx.js';
import { loadSettings, saveSettings, settingsHtml } from './view/settings.js';
import { manualHtml } from './view/manual.js';

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
  const busy = fx.isBusy();
  renderer.draw(state, fx.frame());
  renderHud(state, busy ? [] : actionButtons(state), settings, fx.label());
  // 新しく起きた出来事を演出に回す（描いた後に積むので、カメラ移動は演出側が決める）
  const events = state.events.splice(0);
  if (events.length) fx.enqueue(events);
}

const fx = createFx({
  renderer,
  redraw: () => renderer.draw(state, fx.frame()),
  refresh: () => refresh(),
  onFinish: () => {
    // 演出が終わったら、選択中のユニットへカメラを戻す
    const sel = getUnit(state, state.selectedId);
    if (sel) renderer.centerOn(sel.x, sel.y);
    refresh();
  },
});

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
  fx.skip();
}

const input = createInput({
  canvas, renderer, refresh, restart,
  getState: () => state,
  getSettings: () => settings,
  isBusy: () => fx.isBusy(),
  skipFx: () => fx.skip(),
});

// ログ欄のタップで、直近20件まで広げる／戻す
document.getElementById('log').addEventListener('click', () => {
  toggleLog();
  refresh();
});

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
  // 簡易マニュアルと設定の切り替え
  if (e.target.closest('[data-action="openManual"]')) {
    settingsEl.innerHTML = manualHtml();
    settingsEl.querySelector('.dialog').scrollTop = 0;
    return;
  }
  if (e.target.closest('[data-action="backToSettings"]')) {
    openSettings();
    return;
  }
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
