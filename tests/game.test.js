import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { chooseTarget, runEnemyPhase } from '../src/logic/ai.js';
import {
  attack, canDescend, canSummon, descend, endPlayerPhase, getAttackTargets, getHealTargets,
  getSummonTiles, getThreatTiles, heal, heroes, moveUnit, newGame, setOptions, summon,
} from '../src/logic/game.js';
import { knockOut } from '../src/logic/combat.js';
import { computeVisibility } from '../src/logic/vision.js';
import { distanceField } from '../src/logic/path.js';
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

// 敵をすべて取り除き、A・Bを部屋に置いたまま指定ターンの直前まで進める
function advanceTo(s, turn) {
  while (s.floorTurn < turn - 1) {
    s.units = s.units.filter((u) => u.side !== 'enemy');
    endPlayerPhase(s);
  }
  s.units = s.units.filter((u) => u.side !== 'enemy');
}

test('8ターン目に、見えていない部屋へ増援が出る', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const s = newGame(seed);
    advanceTo(s, CONFIG.spawn.reinforceEvery);
    endPlayerPhase(s);
    assert.equal(s.floorTurn, CONFIG.spawn.reinforceEvery);
    const enemies = s.units.filter((u) => u.side === 'enemy');
    assert.ok(enemies.length >= CONFIG.spawn.reinforceCount[0] && enemies.length <= CONFIG.spawn.reinforceCount[1], `seed ${seed}: ${enemies.length}`);
    const room = s.map.roomIdAt[enemies[0].y * s.map.w + enemies[0].x];
    assert.ok(room >= 0);
    for (const e of enemies) {
      assert.equal(s.map.roomIdAt[e.y * s.map.w + e.x], room, '同じ部屋に出る');
      assert.equal(s.visible[e.y * s.map.w + e.x], 0, '見えていない場所に出る');
    }
  }
});

test('7ターン目には増援が出ない', () => {
  const s = newGame(4);
  advanceTo(s, 7);
  endPlayerPhase(s);
  assert.equal(s.units.filter((u) => u.side === 'enemy').length, 0);
});

test('40ターン目に徘徊者が出て、経路距離が近い方のA・Bを追う', () => {
  const s = newGame(9);
  advanceTo(s, CONFIG.spawn.wandererTurn);
  endPlayerPhase(s);
  const wd = s.units.find((u) => u.kind === 'wanderer');
  assert.ok(wd, '徘徊者が出る');
  assert.equal(s.wandererSpawned, true);
  assert.ok(s.log.some((l) => l.text === '何かの気配がする…' && l.side === 'enemy'));
  const [A, B] = heroes(s);
  const dA = distanceField(s.map, wd)[A.y * s.map.w + A.x];
  const dB = distanceField(s.map, wd)[B.y * s.map.w + B.x];
  const near = dA <= dB ? A : B;
  assert.equal(chooseTarget(s, wd), near);
  // 敵フェイズで近づく
  const before = dA <= dB ? dA : dB;
  s.units = s.units.filter((u) => u.side !== 'enemy' || u === wd);
  endPlayerPhase(s);
  const after = distanceField(s.map, wd)[near.y * s.map.w + near.x];
  assert.ok(after < before, `${before} → ${after}`);
});

test('徘徊者は同じ部屋でも経路距離8以内でもない相手を追う（候補条件を無視）', () => {
  const s = stateFrom([
    '######################',
    '#....................#',
    '######################',
  ], [{ x: 1, y: 1, w: 2, h: 1 }, { x: 19, y: 1, w: 2, h: 1 }]);
  const a = addHero(s, 'A', 1, 1);
  addHero(s, 'B', 2, 1);
  const wd = addEnemy(s, 'wanderer', 20, 1);
  const g = addEnemy(s, 'goblin', 19, 1);
  assert.equal(chooseTarget(s, g), null);
  assert.equal(chooseTarget(s, wd).kind, 'B');
  assert.ok(a);
});

test('弓ゴブリンは3階から出る。敵Lvは階層に沿って上がる', () => {
  assert.equal(CONFIG.enemyLevel(1), 1);
  assert.equal(CONFIG.enemyLevel(5), 6);
  assert.equal(CONFIG.enemyLevel(10), 12);
  assert.equal(CONFIG.enemyLevel(11), 12);
  let archers = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const s = newGame(seed);
    assert.ok(!s.units.some((u) => u.kind === 'archer'), '1階には出ない');
    for (let f = 1; f < CONFIG.archerFromFloor; f++) {
      const [A] = heroes(s);
      A.x = s.map.stairs.x;
      A.y = s.map.stairs.y;
      s.units = s.units.filter((u) => u.side !== 'enemy' || !(u.x === A.x && u.y === A.y));
      descend(s, A.id);
    }
    assert.equal(s.floor, CONFIG.archerFromFloor);
    archers += s.units.filter((u) => u.kind === 'archer').length;
    for (const e of s.units.filter((u) => u.side === 'enemy')) assert.equal(e.lv, CONFIG.enemyLevel(s.floor));
  }
  assert.ok(archers > 0, '3階では弓ゴブリンが混ざる');
});

test('敵の攻撃はログで side=enemy、味方の攻撃は side=ally になり、attack イベントが出る', () => {
  const s = stateFrom(OPEN, OPEN_ROOM);
  const a = addHero(s, 'A', 1, 1);
  addHero(s, 'B', 10, 4);
  const g = addEnemy(s, 'goblin', 2, 1);
  computeVisibility(s);
  attack(s, a.id, g.id);
  assert.equal(s.log.at(-1).side, 'ally');
  const ev = s.events.find((e) => e.type === 'attack');
  assert.deepEqual(
    { side: ev.side, from: ev.from, to: ev.to, damage: ev.damage, targetId: ev.targetId },
    { side: 'ally', from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, damage: a.atk - g.def, targetId: g.id },
  );
  s.events.length = 0;
  endPlayerPhase(s);
  const enemyLogs = s.log.filter((l) => l.text.startsWith('ゴブリンの攻撃'));
  assert.equal(enemyLogs.length, 1);
  assert.equal(enemyLogs[0].side, 'enemy');
  assert.deepEqual(s.events.map((e) => e.type), ['enemyPhase', 'attack', 'playerPhase']);
  assert.equal(s.events[1].side, 'enemy');
  assert.equal(s.events[1].targetId, a.id);
});

test('階層開始で floor イベント、撃破でA・Bが倒れたら down イベント', () => {
  const s = newGame(8);
  assert.deepEqual(s.events.map((e) => e.type), ['floor']);
  assert.equal(s.events[0].floor, 1);
  const s2 = stateFrom(OPEN, OPEN_ROOM);
  const a = addHero(s2, 'A', 1, 1, { hp: 1 });
  addHero(s2, 'B', 10, 4);
  addEnemy(s2, 'goblin', 2, 1);
  endPlayerPhase(s2);
  assert.ok(a.down);
  assert.ok(s2.events.some((e) => e.type === 'down' && e.unitId === a.id));
});

test('石像の自動行動済み：ONなら毎ターン最初から行動済み、OFFなら選べる', () => {
  const s = newGame(12);
  s.units = s.units.filter((u) => u.side !== 'enemy');
  const [A] = heroes(s);
  A.mp = 99;
  const t = getSummonTiles(s, A.id)[0];
  summon(s, A.id, 'statue', t.x, t.y);
  const st = s.units.find((u) => u.kind === 'statue');
  endPlayerPhase(s);
  assert.equal(st.acted, true, 'ON（既定）');
  assert.notEqual(s.selectedId, st.id);
  setOptions(s, { autoSkipStatue: false });
  endPlayerPhase(s);
  assert.equal(st.acted, false, 'OFF');
  setOptions(s, { autoSkipStatue: true });
  assert.equal(st.acted, true, 'ONに戻すとすぐ効く');
});

test('敵の行動範囲：移動範囲は壁と味方を越えず、攻撃範囲は移動範囲の外側', () => {
  const s = stateFrom([
    '#########',
    '#...#...#',
    '#...#...#',
    '#########',
  ]);
  addHero(s, 'A', 7, 1);
  addHero(s, 'B', 1, 2);
  const g = addEnemy(s, 'goblin', 1, 1);
  const { move, attack: atk } = getThreatTiles(s, g.id);
  assert.ok(move.every((p) => p.x <= 3), '壁の向こうへは行けない');
  assert.ok(!move.some((p) => p.x === 1 && p.y === 2), '味方のマスは移動範囲に入らない');
  assert.ok(atk.some((p) => p.x === 1 && p.y === 2), '隣の味方には攻撃が届く');
  assert.ok(!atk.some((p) => move.some((m) => m.x === p.x && m.y === p.y)));
});
