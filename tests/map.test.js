import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { createRng } from '../src/logic/rng.js';
import { generateMap, isConnected, tileAt, TILE } from '../src/logic/map.js';
import { newGame } from '../src/logic/game.js';

const SEEDS = Array.from({ length: 100 }, (_, i) => i + 1);

test('シード100個で床がすべてつながる', () => {
  for (const seed of SEEDS) {
    const map = generateMap(createRng(seed), CONFIG.map);
    assert.ok(isConnected(map), `seed ${seed}`);
  }
});

test('部屋数が roomsMin〜roomsMax', () => {
  for (const seed of SEEDS) {
    const map = generateMap(createRng(seed), CONFIG.map);
    assert.ok(map.rooms.length >= CONFIG.map.roomsMin && map.rooms.length <= CONFIG.map.roomsMax, `seed ${seed}: ${map.rooms.length}`);
  }
});

test('外周が壁', () => {
  for (const seed of SEEDS) {
    const map = generateMap(createRng(seed), CONFIG.map);
    for (let x = 0; x < map.w; x++) {
      assert.equal(tileAt(map, x, 0), TILE.WALL);
      assert.equal(tileAt(map, x, map.h - 1), TILE.WALL);
    }
    for (let y = 0; y < map.h; y++) {
      assert.equal(tileAt(map, 0, y), TILE.WALL);
      assert.equal(tileAt(map, map.w - 1, y), TILE.WALL);
    }
  }
});

test('階段が床の上にちょうど1つある', () => {
  for (const seed of SEEDS) {
    const { map } = newGame(seed);
    assert.equal(tileAt(map, map.stairs.x, map.stairs.y), TILE.STAIRS, `seed ${seed}`);
    assert.equal(map.tiles.filter((t) => t === TILE.STAIRS).length, 1);
    assert.ok(map.roomIdAt[map.stairs.y * map.w + map.stairs.x] >= 0, '階段は部屋の中');
  }
});

test('同じシードで同じマップ', () => {
  for (const seed of SEEDS.slice(0, 20)) {
    const a = newGame(seed).map;
    const b = newGame(seed).map;
    assert.deepEqual(a.tiles, b.tiles);
    assert.deepEqual(a.stairs, b.stairs);
  }
});
