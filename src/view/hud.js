// 上部バー、ログ、ユニットパネル、ボタン、ゲームオーバー画面。

import { CONFIG } from '../config.js';
import { allActed, getUnit, heroes } from '../logic/game.js';

const $ = (id) => document.getElementById(id);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderHud(state, buttons) {
  $('tb-floor').textContent = `${state.floor}階`;
  $('tb-turn').textContent = `ターン ${state.floorTurn}`;
  $('tb-best').textContent = `ベスト ${state.best}階`;
  $('tb-seed').textContent = `seed ${state.seed}`;

  $('log').innerHTML = state.log.slice(-CONFIG.log.show).map((m) => `<div>${esc(m)}</div>`).join('');
  $('panel').innerHTML = panelHtml(state);

  $('actions').innerHTML = buttons
    .map((b) => `<button type="button" data-action="${b.action}"${b.arg ? ` data-arg="${b.arg}"` : ''}${b.disabled ? ' disabled' : ''}>${esc(b.label)}${b.sub ? `<small>${esc(b.sub)}</small>` : ''}</button>`)
    .join('');

  const playing = state.phase === 'player';
  const endBtn = document.querySelector('#controls [data-action="end"]');
  endBtn.disabled = !playing;
  endBtn.classList.toggle('hot', playing && allActed(state));
  document.querySelector('#controls [data-action="next"]').disabled = !playing || allActed(state);

  const overlay = $('overlay');
  if (state.phase === 'gameover') {
    overlay.innerHTML = `
      <div class="big">${state.floor}階で全滅</div>
      <div>ベスト ${state.best}階</div>
      <button type="button" data-action="restart">もう一度</button>`;
    overlay.hidden = false;
  } else {
    overlay.hidden = true;
  }
}

function heroSummary(h) {
  if (h.down) return `<span class="down">${h.name}：退場中（次の階層で復活）</span>`;
  return `<span>${h.name} Lv${h.lv} HP${h.hp}/${h.maxHp} MP${h.mp}/${h.maxMp}</span>`;
}

function unitDetail(u) {
  const range = u.rangeMin === u.rangeMax ? `${u.rangeMin}` : `${u.rangeMin}〜${u.rangeMax}`;
  const parts = [
    `<span class="name${u.side === 'enemy' ? ' enemy' : ''}">${esc(u.name)}</span> Lv${u.lv}`,
    `HP ${u.hp}/${u.maxHp}`,
  ];
  if (u.maxMp > 0) parts.push(`MP ${u.mp}/${u.maxMp}`);
  if (u.side === 'ally' && (u.kind === 'A' || u.kind === 'B')) parts.push(`EXP ${u.exp}/${CONFIG.expToNext(u.lv)}`);
  const stats = [`攻${u.atk}`, `防${u.def}`, `移${u.mov}`, `射${range}`];
  if (u.heal) stats.push(`回復${u.heal}`);
  if (u.side === 'ally') stats.push(u.acted ? '行動済み' : u.moved ? '移動済み' : '');
  return `<div>${parts.join('　')}</div><div>${stats.filter(Boolean).join(' ')}</div>`;
}

function panelHtml(state) {
  const summary = `<div class="heroes">${heroes(state).map(heroSummary).join('')}</div>`;
  const inspect = state.ui.inspectId != null ? getUnit(state, state.ui.inspectId) : null;
  const u = inspect && !inspect.down ? inspect : getUnit(state, state.selectedId);
  return summary + (u && !u.down ? unitDetail(u) : '<div>味方をタップして選択</div>');
}
