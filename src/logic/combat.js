// ダメージ計算、撃破、EXP付与、戦闘不能（6-4, 6-5, 7-2）。

import { CONFIG } from '../config.js';
import { gainExp, isHero } from './units.js';
import { addLog } from './log.js';

// 必中・乱数なし・反撃なし
export function calcDamage(attacker, target) {
  return Math.max(1, attacker.atk - target.def);
}

export function applyAttack(state, attacker, target) {
  const dmg = calcDamage(attacker, target);
  target.hp -= dmg;
  addLog(state, `${attacker.name}の攻撃 → ${target.name}に${dmg}ダメージ`);
  if (target.hp <= 0) {
    target.hp = 0;
    if (target.side === 'enemy') defeatEnemy(state, attacker, target);
    else knockOut(state, target);
  }
  return dmg;
}

function removeUnit(state, unit) {
  const i = state.units.indexOf(unit);
  if (i >= 0) state.units.splice(i, 1);
  if (state.selectedId === unit.id) state.selectedId = null;
  if (state.ui?.inspectId === unit.id) state.ui.inspectId = null;
}

// 敵を倒した：倒したユニットにEXP（召喚ユニットが倒したら召喚者へ）。EXPを得たA・BはMP+1
function defeatEnemy(state, attacker, enemy) {
  removeUnit(state, enemy);
  addLog(state, `${enemy.name}を倒した`);
  const earner = attacker.summonerId != null
    ? state.units.find((u) => u.id === attacker.summonerId)
    : attacker;
  if (!earner || !isHero(earner) || earner.down) return;
  const ups = gainExp(earner, enemy.expReward);
  earner.mp = Math.min(earner.maxMp, earner.mp + CONFIG.mp.onKill);
  addLog(state, `${earner.name}は${enemy.expReward}EXPを得た${ups ? `。Lv${earner.lv}に上がった！` : ''}`);
}

// 味方が倒された。A・Bなら退場（召喚ユニットも消える）、召喚ユニットなら消えるだけ
export function knockOut(state, unit) {
  if (!isHero(unit)) {
    removeUnit(state, unit);
    addLog(state, `${unit.name}が消えた`);
    return;
  }
  unit.hp = 0;
  unit.down = true;
  unit.moved = unit.acted = true;
  if (state.selectedId === unit.id) state.selectedId = null;
  for (const s of state.units.filter((u) => u.summonerId === unit.id)) removeUnit(state, s);
  addLog(state, `${unit.name}が倒れた（次の階層で復活）`);
  const heroes = state.units.filter(isHero);
  if (heroes.every((h) => h.down)) {
    state.phase = 'gameover';
    addLog(state, `${state.floor}階で全滅した`);
  }
}
