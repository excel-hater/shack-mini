// 設定（歯車）。localStorage に保存する。使えない環境でも既定値で動く。

import { CONFIG } from '../config.js';

export const DEFAULT_SETTINGS = {
  autoEndTurn: true,    // 全員が行動したら自動でターン終了
  tapToAct: true,       // 攻撃できる敵・回復できる味方を直接タップで実行
  autoSkipStatue: true, // 石像を最初から行動済みにする
};

const ITEMS = [
  { key: 'autoEndTurn', label: '自動でターン終了', note: '全員が行動したら、そのまま敵のターンへ' },
  { key: 'tapToAct', label: '敵を直接タップで攻撃', note: '赤い敵・水色の味方をタップするだけで攻撃・回復' },
  { key: 'autoSkipStatue', label: '石像は自動で行動済み', note: '動けない石像を毎ターン選ばない' },
];

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG.settingsKey) || '{}');
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(CONFIG.settingsKey, JSON.stringify(settings));
  } catch {
    // 保存できなくても、このページを開いている間は効く
  }
}

export function settingsHtml(settings, seed) {
  const rows = ITEMS.map((it) => `
    <label class="setting">
      <input type="checkbox" data-setting="${it.key}"${settings[it.key] ? ' checked' : ''}>
      <span><b>${it.label}</b><small>${it.note}</small></span>
    </label>`).join('');
  return `
    <div class="dialog" role="dialog" aria-label="設定">
      <h2>設定</h2>
      ${rows}
      <button type="button" class="manual-open" data-action="openManual">遊び方（簡易マニュアル）</button>
      <p class="seed">seed ${seed}（URLに <code>?seed=${seed}</code> を付けると同じマップで遊べる）</p>
      <button type="button" data-action="closeSettings">閉じる</button>
    </div>`;
}
