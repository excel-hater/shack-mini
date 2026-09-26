import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { computeReachable, manhattan } from '../src/logic/path.js';
import { roomCenter } from '../src/logic/map.js';
import { heroes, newGame } from '../src/logic/game.js';
import { addEnemy, addHero, stateFrom } from './helpers.js';

const has = (stops, x, y) => stops.some((p) => p.x === x && p.y === y);

test('移動範囲は壁を越えない', () => {
  const s = stateFrom([
    '#######',
    '#..#..#',
    '#..#..#',
    '#######',
  ]);
  const a = addHero(s, 'A', 1, 1, { mov: 10 });
  const stops = computeReachable(s.map, a, s.units);
  assert.ok(has(stops, 2, 2));
  assert.ok(!has(stops, 4, 1), '壁の向こうには行けない');
  assert.ok(!has(stops, 3, 1), '壁には止まれない');
});

test('移動範囲は移動力を超えない（4方向の歩数）', () => {
  const s = stateFrom([
    '#########',
    '#.......#',
    '#.......#',
    '#.......#',
    '#########',
  ]);
  const a = addHero(s, 'A', 1, 1, { mov: 3 });
  const stops = computeReachable(s.map, a, s.units);
  for (const p of stops) assert.ok(manhattan(p, a) <= 3);
  assert.ok(has(stops, 4, 1));
  assert.ok(!has(stops, 5, 1));
  assert.ok(has(stops, 3, 2));
  assert.ok(!has(stops, 4, 3), '斜めは2歩ずつ数える');
});

test('味方のマスは通り抜けられるが止まれない。敵のマスは通れない', () => {
  const s = stateFrom([
    '#######',
    '#.....#',
    '#######',
  ]);
  const a = addHero(s, 'A', 1, 1, { mov: 4 });
  addHero(s, 'B', 2, 1);
  let stops = computeReachable(s.map, a, s.units);
  assert.ok(!has(stops, 2, 1), '味方のマスには止まれない');
  assert.ok(has(stops, 3, 1), '味方を通り抜けられる');

  const s2 = stateFrom(['#######', '#.....#', '#######']);
  const a2 = addHero(s2, 'A', 1, 1, { mov: 4 });
  addEnemy(s2, 'goblin', 2, 1);
  stops = computeReachable(s2.map, a2, s2.units);
  assert.ok(!has(stops, 2, 1));
  assert.ok(!has(stops, 3, 1), '敵は通り抜けられない');
});

test('A・Bは別々の部屋に落ち、部屋の中心間距離は可能な限り15以上', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const s = newGame(seed);
    const [A, B] = heroes(s);
    const ra = s.map.roomIdAt[A.y * s.map.w + A.x];
    const rb = s.map.roomIdAt[B.y * s.map.w + B.x];
    assert.ok(ra >= 0 && rb >= 0 && ra !== rb, `seed ${seed}`);
    const rooms = s.map.rooms;
    let possible = false;
    for (const r1 of rooms) for (const r2 of rooms) if (manhattan(roomCenter(r1), roomCenter(r2)) >= CONFIG.map.dropMinDistance) possible = true;
    if (possible) {
      assert.ok(manhattan(roomCenter(rooms[ra]), roomCenter(rooms[rb])) >= CONFIG.map.dropMinDistance, `seed ${seed}`);
    }
    const stairsRoom = s.map.roomIdAt[s.map.stairs.y * s.map.w + s.map.stairs.x];
    assert.ok(stairsRoom !== ra && stairsRoom !== rb, '階段はA・Bの部屋以外');
  }
});
