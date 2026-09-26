import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { applyAttack, calcDamage } from '../src/logic/combat.js';
import { gainExp } from '../src/logic/units.js';
import { addEnemy, addHero, addSummon, stateFrom } from './helpers.js';

const ROOM = ['#######', '#.....#', '#.....#', '#######'];

test('ダメージは max(1, 攻撃 − 防御)', () => {
  assert.equal(calcDamage({ atk: 8 }, { def: 2 }), 6);
  assert.equal(calcDamage({ atk: 3 }, { def: 5 }), 1);
  assert.equal(calcDamage({ atk: 4 }, { def: 4 }), 1);
});

test('1階の手応え：ゴブリンLv1に対しAは6、Bは5ダメージ。ゴブリンはAに2、Bに4', () => {
  const s = stateFrom(ROOM);
  const a = addHero(s, 'A', 1, 1);
  const b = addHero(s, 'B', 2, 1);
  const g = addEnemy(s, 'goblin', 3, 1, 1);
  assert.equal(calcDamage(a, g), 6);
  assert.equal(calcDamage(b, g), 5);
  assert.equal(calcDamage(g, a), 2);
  assert.equal(calcDamage(g, b), 4);
});

test('EXPは繰り越され、1回で複数レベル上がれる', () => {
  const s = stateFrom(ROOM);
  const a = addHero(s, 'A', 1, 1);
  const g = CONFIG.heroes.A.grow;
  // Lv1→2 に10、Lv2→3 に20。35 入れると Lv3 で 5 余る
  const ups = gainExp(a, 35);
  assert.equal(ups, 2);
  assert.equal(a.lv, 3);
  assert.equal(a.exp, 5);
  assert.equal(a.maxHp, CONFIG.heroes.A.hp + 2 * g.hp);
  assert.equal(a.hp, a.maxHp, '最大HPが増えた分だけ現在HPも増える');
  assert.equal(a.atk, CONFIG.heroes.A.atk + 2 * g.atk);
  assert.equal(a.maxMp, CONFIG.heroes.A.mp + 2 * g.mp);
});

test('敵を倒すと倒したユニットにEXPとMP+1が入り、敵は消える', () => {
  const s = stateFrom(ROOM);
  const a = addHero(s, 'A', 1, 1, { mp: 0 });
  const b = addHero(s, 'B', 4, 1);
  const g = addEnemy(s, 'goblin', 2, 1, 1, { hp: 1 });
  applyAttack(s, a, g);
  assert.ok(!s.units.includes(g));
  assert.equal(a.exp, g.expReward);
  assert.equal(a.mp, 1);
  assert.equal(b.exp, 0, '倒していない方には入らない');
});

test('召喚ユニットが倒したEXPは召喚者に入る', () => {
  const s = stateFrom(ROOM);
  const b = addHero(s, 'B', 1, 1);
  const w = addSummon(s, 'warrior', b, 2, 1);
  const g = addEnemy(s, 'goblin', 3, 1, 1, { hp: 1 });
  applyAttack(s, w, g);
  assert.equal(b.exp, g.expReward);
});

test('退場中のユニットはEXPを得ない', () => {
  const s = stateFrom(ROOM);
  const b = addHero(s, 'B', 1, 1, { down: true });
  assert.equal(gainExp(b, 100), 0);
  assert.equal(b.exp, 0);
});

test('A・Bが倒れると退場し、その召喚ユニットも消える', () => {
  const s = stateFrom(ROOM);
  const a = addHero(s, 'A', 1, 1);
  addHero(s, 'B', 5, 2);
  const st = addSummon(s, 'statue', a, 1, 2);
  const g = addEnemy(s, 'goblin', 2, 1, 1, { atk: 999 });
  applyAttack(s, g, a);
  assert.equal(a.down, true);
  assert.ok(!s.units.includes(st));
  assert.equal(s.phase, 'player', '1人残っていれば続行');
});
