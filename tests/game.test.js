import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { chooseTarget, runEnemyPhase } from '../src/logic/ai.js';
import {
  attack, canDescend, canSummon, descend, endPlayerPhase, getAttackTargets, getHealTargets,
  getSummonTiles, heal, heroes, moveUnit, newGame, summon,
} from '../src/logic/game.js';
import { knockOut } from '../src/logic/combat.js';
import { computeVisibility } from '../src/logic/vision.js';
import { addEnemy, addHero, addSummon, stateFrom } from './helpers.js';

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

// 選んだヒーローを階段の上に置く（敵は取り除く）
function onStairs(s, hero) {
  s.units = s.units.filter((u) => u.side !== 'enemy');
  hero.x = s.map.stairs.x;
  hero.y = s.map.stairs.y;
  computeVisibility(s);
}

test('片方が退場した状態で降りると、次の階層でHP1で復活し、その部屋に敵がいない', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const s = newGame(seed);
    const [A, B] = heroes(s);
    B.down = true;
    B.hp = 0;
    onStairs(s, A);
    const hpA = A.hp;
    assert.equal(descend(s, A.id), true);
    assert.equal(s.floor, 2);
    assert.equal(s.best, 2);
    assert.equal(B.down, false);
    assert.equal(B.hp, CONFIG.reviveHp);
    assert.equal(A.hp, hpA, 'HPはそのまま持ち越し');
    const w = s.map.w;
    const roomB = s.map.roomIdAt[B.y * w + B.x];
    assert.ok(roomB >= 0);
    assert.ok(!s.units.some((u) => u.side === 'enemy' && s.map.roomIdAt[u.y * w + u.x] === roomB), `seed ${seed}`);
    assert.equal(s.floorTurn, 1);
    assert.equal(s.units.filter((u) => u.side === 'enemy').length, CONFIG.spawn.base);
  }
});

test('降りるとMPが最大の50%（切り上げ）回復し、Lv・EXPは持ち越す', () => {
  const s = newGame(5);
  const [A, B] = heroes(s);
  B.mp = 1;
  B.exp = 7;
  onStairs(s, B);
  descend(s, B.id);
  assert.equal(B.mp, Math.min(B.maxMp, 1 + Math.ceil(B.maxMp * CONFIG.mp.onDescendRatio)));
  assert.equal(B.exp, 7);
  assert.equal(A.mp, A.maxMp);
});

test('階段の上にいないと降りられない', () => {
  const s = newGame(5);
  const [A] = heroes(s);
  assert.equal(canDescend(s, A.id), false);
  assert.equal(descend(s, A.id), false);
  assert.equal(s.floor, 1);
});

test('召喚：MP不足・上限2体のときは召喚できない', () => {
  const s = stateFrom(OPEN, OPEN_ROOM);
  const b = addHero(s, 'B', 5, 2);
  addHero(s, 'A', 1, 1);
  b.mp = CONFIG.summons.warrior.mp - 1;
  assert.equal(canSummon(s, b.id, 'warrior'), false);
  assert.equal(summon(s, b.id, 'warrior', 5, 3), false);
  b.mp = 99;
  assert.equal(canSummon(s, b.id, 'warrior'), true);
  addSummon(s, 'hound', b, 4, 2);
  addSummon(s, 'hound', b, 6, 2);
  assert.equal(canSummon(s, b.id, 'warrior'), false, '上限2体');
});

test('召喚：距離2以内の空いている床に出せて、出したターンは動かせない', () => {
  const s = stateFrom(OPEN, OPEN_ROOM);
  const b = addHero(s, 'B', 5, 2);
  addHero(s, 'A', 1, 1);
  computeVisibility(s);
  const tiles = getSummonTiles(s, b.id);
  assert.ok(tiles.every((p) => Math.abs(p.x - 5) + Math.abs(p.y - 2) <= CONFIG.summon.placeRange));
  assert.equal(summon(s, b.id, 'hound', 9, 2), false, '遠すぎる');
  const mp = b.mp;
  assert.equal(summon(s, b.id, 'hound', 6, 3), true);
  assert.equal(b.mp, mp - CONFIG.summons.hound.mp);
  assert.equal(b.acted, true);
  const h = s.units.find((u) => u.kind === 'hound');
  assert.equal(h.summonerId, b.id);
  assert.equal(moveUnit(s, h.id, 6, 4), false, '出したターンは動かせない');
  assert.equal(h.hp, CONFIG.summons.hound.make(b.lv).hp);
});

test('召喚ユニットは召喚者の退場と階段で消える', () => {
  const s = newGame(11);
  s.units = s.units.filter((u) => u.side !== 'enemy');
  const [A, B] = heroes(s);
  A.mp = 99;
  B.mp = 99;
  const ta = getSummonTiles(s, A.id)[0];
  summon(s, A.id, 'statue', ta.x, ta.y);
  const tb = getSummonTiles(s, B.id)[0];
  summon(s, B.id, 'warrior', tb.x, tb.y);
  assert.equal(s.units.length, 4);
  knockOut(s, B);
  assert.equal(s.units.filter((u) => u.summonerId === B.id).length, 0, '召喚者の退場で消える');
  assert.equal(s.units.filter((u) => u.summonerId === A.id).length, 1);
  endPlayerPhase(s);
  A.x = s.map.stairs.x;
  A.y = s.map.stairs.y;
  descend(s, A.id);
  assert.equal(s.units.filter((u) => u.summonerId != null).length, 0, '階段で消える');
});

test('猟犬を先の部屋に入れると、その部屋が見える', () => {
  const s = stateFrom([
    '##############',
    '#...#....#...#',
    '#...........>#',
    '#...#....#...#',
    '##############',
  ], [{ x: 1, y: 1, w: 3, h: 3 }, { x: 10, y: 1, w: 3, h: 3 }]);
  const b = addHero(s, 'B', 1, 2);
  addHero(s, 'A', 1, 1);
  computeVisibility(s);
  assert.equal(s.visible[2 * s.map.w + 12], 0, '最初は奥の部屋が見えない');
  addSummon(s, 'hound', b, 10, 1);
  computeVisibility(s);
  assert.equal(s.visible[2 * s.map.w + 12], 1, '猟犬の視界で見える');
  assert.equal(s.seen[2 * s.map.w + 12], 1);
});

test('癒し手は隣接する味方を回復できる（自分は対象外）', () => {
  const s = stateFrom(OPEN, OPEN_ROOM);
  const a = addHero(s, 'A', 3, 2, { hp: 5 });
  addHero(s, 'B', 9, 4);
  const h = addSummon(s, 'healer', a, 4, 2, { moved: false, acted: false, hp: 1 });
  assert.deepEqual(getHealTargets(s, h.id).map((t) => t.id), [a.id]);
  assert.equal(heal(s, h.id, a.id), true);
  assert.equal(a.hp, 5 + h.heal);
});
