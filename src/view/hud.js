// 上部バー、ログ、ユニットパネル、ボタン、ゲームオーバー画面。

import { CONFIG } from '../config.js';
import { allActed, getUnit, heroes } from '../logic/game.js';
import { guideText } from './guide.js';
import { unitColor, unitMark } from './marks.js';
import { isHero } from '../logic/units.js';

const $ = (id) => document.getElementById(id);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderHud(state, buttons, settings, playing = null) {
  $('tb-floor').textContent = `${state.floor}階`;
  $('tb-turn').textContent = `ターン ${state.floorTurn}`;
  $('tb-best').textContent = `ベスト ${state.best}階`;

  const enemyTurn = state.phase === 'enemy' || (playing && playing.includes('敵'));
  const phase = $('tb-phase');
  phase.textContent = enemyTurn ? '敵の番' : '味方の番';
  phase.className = enemyTurn ? 'enemy' : 'ally';
  phase.hidden = state.phase === 'gameover';

  $('log').innerHTML = logHtml(state.log);
  $('log').classList.toggle('expanded', logExpanded);
  $('panel').innerHTML = panelHtml(state);

  const g = guideText(state, settings, playing);
  const guide = $('guide');
  guide.hidden = !g;
  if (g) {
    guide.className = `tone-${g.tone}`;
    guide.innerHTML = (g.who ? `<span class="badge" style="background:${g.who.color}">${esc(g.who.text)}</span>` : '')
      + `<span class="text">${esc(g.text)}</span>`;
  }

  $('actions').innerHTML = buttons
    .map((b) => `<button type="button" class="act-${b.action}" data-action="${b.action}"${b.arg ? ` data-arg="${b.arg}"` : ''}${b.disabled ? ' disabled' : ''}>${esc(b.label)}${b.sub ? `<small>${esc(b.sub)}</small>` : ''}</button>`)
    .join('');

  const myTurn = state.phase === 'player' && !playing;
  const endBtn = document.querySelector('#controls [data-action="end"]');
  endBtn.disabled = !myTurn;
  endBtn.classList.toggle('hot', myTurn && allActed(state));
  document.querySelector('#controls [data-action="next"]').disabled = !myTurn || allActed(state);

  const overlay = $('overlay');
  // 全滅の演出を見せ終わってからゲームオーバー画面を出す
  if (state.phase === 'gameover' && !playing) {
    overlay.innerHTML = `
      <div class="title">shack-mini</div>
      <div class="big">${state.floor}階で全滅</div>
      <div>ベスト ${state.best}階</div>
      <button type="button" data-action="restart">もう一度</button>`;
    overlay.hidden = false;
  } else {
    overlay.hidden = true;
  }
}

let logExpanded = false;

export function toggleLog() {
  logExpanded = !logExpanded;
}

const LOG_TAG = { ally: '味方', enemy: '敵' };

// 敵の行動は赤く、味方の行動は青いタグ付きで。ターンが変わるところに区切りを入れる
function logHtml(log) {
  const list = logExpanded ? log : log.slice(-CONFIG.log.show);
  let prev = null;
  const out = logExpanded ? ['<div class="log-head">ログ（直近20件・タップで閉じる）</div>'] : [];
  for (const m of list) {
    const key = `${m.floor}-${m.turn}`;
    if (prev !== null && key !== prev) out.push(`<div class="sep">— ${m.floor}階 ターン${m.turn} —</div>`);
    prev = key;
    const tag = LOG_TAG[m.side] ? `<span class="who">${LOG_TAG[m.side]}</span>` : '';
    out.push(`<div class="entry ${m.side}">${tag}${esc(m.text)}</div>`);
  }
  return out.join('');
}

const pct = (v, max) => `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%`;

function hpClass(u) {
  const r = u.hp / u.maxHp;
  return r > 0.5 ? 'hi' : r > 0.25 ? 'mid' : 'lo';
}

function bar(cls, v, max) {
  return `<span class="bar ${cls}"><i style="width:${pct(v, max)}"></i></span>`;
}

// A・B の要約チップ。タップでそのヒーローを選ぶ
function heroChip(state, h) {
  const status = h.down ? 'down' : h.acted ? 'done' : 'ready';
  const tag = { down: '退場中', done: '行動済', ready: '未行動' }[status];
  const sel = h.id === state.selectedId ? ' selected' : '';
  const body = h.down
    ? '<span class="note">次の階層で復活</span>'
    : `<span class="nums">${bar(`hp ${hpClass(h)}`, h.hp, h.maxHp)}HP${h.hp}/${h.maxHp}</span>`
      + `<span class="nums">${bar('mp', h.mp, h.maxMp)}MP${h.mp}</span>`;
  return `<button type="button" class="chip ${status}${sel}" data-action="selectHero" data-arg="${h.id}"${h.down ? ' disabled' : ''}>`
    + `<span class="badge">${h.name}</span><span class="lv">Lv${h.lv}</span>${body}<span class="tag">${tag}</span></button>`;
}

function unitDetail(u) {
  const range = u.rangeMin === u.rangeMax ? `${u.rangeMin}` : `${u.rangeMin}〜${u.rangeMax}`;
  const enemy = u.side === 'enemy';
  const head = [
    `<span class="badge" style="background:${unitColor(u)}">${esc(unitMark(u))}</span>`,
    `<span class="name${enemy ? ' enemy' : ''}">${esc(u.name)}</span>`,
    `Lv${u.lv}`,
    `${bar(`hp ${hpClass(u)}`, u.hp, u.maxHp)}HP ${u.hp}/${u.maxHp}`,
  ];
  if (u.maxMp > 0) head.push(`MP ${u.mp}/${u.maxMp}`);
  if (isHero(u)) head.push(`EXP ${u.exp}/${CONFIG.expToNext(u.lv)}`);
  const stats = [`攻${u.atk}`, `防${u.def}`, `移${u.mov}`, `射${range}`];
  if (u.heal) stats.push(`回復${u.heal}`);
  if (enemy) stats.push('<span class="enemy">敵</span>');
  else if (u.acted) stats.push('<span class="tag done">行動済</span>');
  else if (u.moved) stats.push('<span class="tag">移動済</span>');
  return `<div class="detail">${head.join(' ')}</div><div class="stats">${stats.join(' ')}</div>`;
}

function panelHtml(state) {
  const summary = `<div class="heroes">${heroes(state).map((h) => heroChip(state, h)).join('')}</div>`;
  const inspect = state.ui.inspectId != null ? getUnit(state, state.ui.inspectId) : null;
  const u = inspect && !inspect.down ? inspect : getUnit(state, state.selectedId);
  return summary + (u && !u.down ? unitDetail(u) : '<div class="detail muted">ユニットをタップすると詳しく表示</div>');
}
