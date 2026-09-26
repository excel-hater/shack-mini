// 敵の行動決定（6-6）。敵を配列順に1体ずつ動かす。

import { CONFIG } from '../config.js';
import { idx, roomIdAt } from './map.js';
import { computeReachable, distanceField, inRange } from './path.js';
import { applyAttack } from './combat.js';
import { isHero } from './units.js';

export function runEnemyPhase(state) {
  for (const e of [...state.units]) {
    if (state.phase === 'gameover') return;
    if (e.side !== 'enemy' || !state.units.includes(e)) continue;
    actEnemy(state, e);
  }
}

const far = (d) => (d < 0 ? Infinity : d);

// 標的を決める。いなければ null
export function chooseTarget(state, enemy) {
  const map = state.map;
  const fromEnemy = distanceField(map, enemy);
  const pathDist = (u) => far(fromEnemy[idx(map, u.x, u.y)]);
  const allies = state.units.filter((u) => u.side === 'ally' && !u.down);

  if (enemy.kind === 'wanderer') {
    // 徘徊者は候補条件を無視し、経路距離が近い方のA・Bを追う
    const hs = allies.filter(isHero).sort((a, b) => pathDist(a) - pathDist(b) || a.id - b.id);
    return hs[0] ?? null;
  }

  const myRoom = roomIdAt(map, enemy.x, enemy.y);
  const cands = allies.filter((a) =>
    (myRoom >= 0 && roomIdAt(map, a.x, a.y) === myRoom) || pathDist(a) <= CONFIG.spawn.detectRange);
  cands.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || pathDist(a) - pathDist(b) || a.id - b.id);
  return cands[0] ?? null;
}

function actEnemy(state, e) {
  const target = chooseTarget(state, e);
  if (!target) return;
  if (inRange(e, target, e.rangeMin, e.rangeMax)) {
    applyAttack(state, e, target);
    return;
  }
  const map = state.map;
  const toTarget = distanceField(map, target);
  const stops = computeReachable(map, e, state.units);
  const inR = stops.filter((p) => inRange(p, target, e.rangeMin, e.rangeMax));
  const pool = inR.length ? inR : stops;
  const score = (p) => far(toTarget[idx(map, p.x, p.y)]);
  pool.sort((a, b) => score(a) - score(b) || a.d - b.d);
  const dest = pool[0];
  if (dest) {
    e.x = dest.x;
    e.y = dest.y;
  }
  if (inRange(e, target, e.rangeMin, e.rangeMax)) applyAttack(state, e, target);
}
