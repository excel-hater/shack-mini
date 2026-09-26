// 味方・敵・召喚の生成と、レベルアップ。

import { CONFIG } from '../config.js';

function baseUnit(id, side, kind, name, stats, x, y) {
  return {
    id, side, kind, name,
    x, y,
    lv: stats.lv ?? 1, exp: 0,
    hp: stats.hp, maxHp: stats.hp,
    atk: stats.atk, def: stats.def,
    mp: stats.mp ?? 0, maxMp: stats.mp ?? 0,
    mov: stats.mov,
    rangeMin: stats.range[0], rangeMax: stats.range[1],
    canAttack: stats.canAttack ?? true,
    heal: stats.heal ?? 0,
    expReward: stats.exp ?? 0,
    summonerId: null,
    down: false,
    moved: false, acted: false,
    moveFrom: null,     // 移動前の位置（「戻す」用）
    regenCounter: 0,
  };
}

export function createHero(id, kind, x, y) {
  const h = CONFIG.heroes[kind];
  return baseUnit(id, 'ally', kind, h.name, h, x, y);
}

export function createEnemy(id, kind, lv, x, y) {
  const e = CONFIG.enemies[kind](lv);
  return baseUnit(id, 'enemy', kind, e.name, { ...e, lv }, x, y);
}

export function createSummon(id, kind, summoner, x, y) {
  const def = CONFIG.summons[kind];
  const u = baseUnit(id, 'ally', kind, def.name, { ...def.make(summoner.lv), lv: summoner.lv }, x, y);
  u.summonerId = summoner.id;
  // 出したターンは動けない
  u.moved = true;
  u.acted = true;
  return u;
}

export function isHero(u) {
  return u.kind === 'A' || u.kind === 'B';
}

// EXPを加え、必要量を超えるたびにレベルアップする（繰り越しあり）。上がったLv数を返す
export function gainExp(unit, amount) {
  const grow = CONFIG.heroes[unit.kind]?.grow;
  if (!grow || unit.down) return 0;
  unit.exp += amount;
  let ups = 0;
  while (unit.exp >= CONFIG.expToNext(unit.lv)) {
    unit.exp -= CONFIG.expToNext(unit.lv);
    unit.lv++;
    unit.maxHp += grow.hp;
    unit.hp += grow.hp;
    unit.atk += grow.atk;
    unit.def += grow.def;
    unit.maxMp += grow.mp;
    ups++;
  }
  return ups;
}
