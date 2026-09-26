import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { chooseTarget, runEnemyPhase } from '../src/logic/ai.js';
import { attack, endPlayerPhase, getAttackTargets, heroes, newGame } from '../src/logic/game.js';
import { computeVisibility } from '../src/logic/vision.js';
import { addEnemy, addHero, stateFrom } from './helpers.js';

const OPEN = [
  '############',
  '#..........#',
  '#..........#',
  '#..........#',
  '#..........#',
  '############',
];
const OPEN_ROOM = [{ x: 1, y: 1, w: 10, h: 4 }];

test('敵はHP割合の低い味方を狙う', () => {
  const s = stateFrom(OPEN, OPEN_ROOM);
  const a = addHero(s, 'A', 2, 2, { hp: 10 });   // 10/30
  const b = addHero(s, 'B', 8, 2, { hp: 15 });   // 15/20
  const g = addEnemy(s, 'goblin', 7, 2);        // B の方が近い
  assert.equal(chooseTarget(s, g), a);
  b.hp = 5;                                      // 5/20 < 10/30
  assert.equal(chooseTarget(s, g), b);
});

test('HP割合が同じなら近い方を狙う', () => {
  const s = stateFrom(OPEN, OPEN_ROOM);
  const a = addHero(s, 'A', 1, 1);
  const b = addHero(s, 'B', 9, 1);
  const g = addEnemy(s, 'goblin', 7, 1);
  assert.equal(chooseTarget(s, g), b);
  assert.notEqual(chooseTarget(s, g), a);
});

test('別の部屋で経路距離が遠い味方には反応しない', () => {
  const s = stateFrom([
    '##################',
    '#................#',
    '#...##########...#',
    '##################',
  ], [{ x: 1, y: 1, w: 3, h: 2 }, { x: 14, y: 1, w: 3, h: 2 }]);
  addHero(s, 'A', 1, 1);
  const g = addEnemy(s, 'goblin', 16, 1);
  assert.equal(chooseTarget(s, g), null);
  runEnemyPhase(s);
  assert.deepEqual([g.x, g.y], [16, 1], '候補がいなければ待機');
});

test('敵は射程外なら近づいて攻撃する', () => {
  const s = stateFrom(OPEN, OPEN_ROOM);
  const a = addHero(s, 'A', 1, 1);
  addHero(s, 'B', 1, 4);
  const g = addEnemy(s, 'goblin', 5, 1);
  runEnemyPhase(s);
  assert.equal(Math.abs(g.x - a.x) + Math.abs(g.y - a.y), 1);
  assert.equal(a.hp, a.maxHp - Math.max(1, g.atk - a.def));
});

test('A・B両方が退場するとゲームオーバー', () => {
  const s = stateFrom(OPEN, OPEN_ROOM);
  addHero(s, 'A', 1, 1, { hp: 1 });
  addHero(s, 'B', 3, 1, { hp: 1 });
  addEnemy(s, 'goblin', 2, 1);
  addEnemy(s, 'goblin', 2, 2);
  endPlayerPhase(s);
  assert.ok(heroes(s).every((h) => h.down));
  assert.equal(s.phase, 'gameover');
});

test('プレイヤーの攻撃：射程内の見えている敵だけ攻撃でき、行動済みになる', () => {
  const s = stateFrom(OPEN, OPEN_ROOM);
  const b = addHero(s, 'B', 1, 1);
  addHero(s, 'A', 10, 4);
  const near = addEnemy(s, 'goblin', 2, 1);   // 距離1：Bの射程(2〜3)外
  const mid = addEnemy(s, 'goblin', 3, 2);    // 距離3
  computeVisibility(s);
  const ids = getAttackTargets(s, b.id).map((t) => t.id);
  assert.deepEqual(ids, [mid.id]);
  assert.equal(attack(s, b.id, near.id), false);
  assert.equal(attack(s, b.id, mid.id), true);
  assert.equal(b.acted, true);
  assert.equal(mid.hp, mid.maxHp - (b.atk - mid.def));
});

test('3の倍数のターン開始時にA・Bが最大HPの5%（切り上げ）回復する', () => {
  const s = newGame(3);
  for (const u of s.units.filter((u) => u.side === 'enemy')) s.units.splice(s.units.indexOf(u), 1);
  const [A] = heroes(s);
  A.hp = 10;
  endPlayerPhase(s); // → ターン2
  assert.equal(A.hp, 10);
  endPlayerPhase(s); // → ターン3
  assert.equal(A.hp, 10 + Math.ceil(A.maxHp * CONFIG.regen.ratio));
});

test('階層開始時の敵はA・Bの部屋にいない', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const s = newGame(seed);
    const w = s.map.w;
    const heroRooms = heroes(s).map((h) => s.map.roomIdAt[h.y * w + h.x]);
    const enemies = s.units.filter((u) => u.side === 'enemy');
    assert.equal(enemies.length, CONFIG.spawn.base);
    for (const e of enemies) assert.ok(!heroRooms.includes(s.map.roomIdAt[e.y * w + e.x]), `seed ${seed}`);
  }
});
