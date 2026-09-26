// テスト用：文字の図からマップと state を作る。
//   # 壁 / . 床 / > 階段。部屋は rooms で矩形を指定（省略時は部屋なし＝全部通路扱い）

import { createRng } from '../src/logic/rng.js';
import { createEnemy, createHero, createSummon } from '../src/logic/units.js';

export function mapFrom(lines, rooms = []) {
  const h = lines.length;
  const w = lines[0].length;
  const map = {
    w, h,
    tiles: new Uint8Array(w * h),
    rooms: rooms.map((r, id) => ({ id, ...r })),
    roomIdAt: new Int8Array(w * h).fill(-1),
    stairs: null,
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = lines[y][x];
      map.tiles[y * w + x] = c === '#' ? 0 : c === '>' ? 2 : 1;
      if (c === '>') map.stairs = { x, y };
    }
  }
  for (const r of map.rooms) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) map.roomIdAt[y * w + x] = r.id;
  }
  return map;
}

export function stateFrom(lines, rooms = [], extra = {}) {
  const map = mapFrom(lines, rooms);
  return {
    seed: 1, rng: createRng(1), floor: 1, best: 1, floorTurn: 1, phase: 'player',
    map, seen: new Uint8Array(map.w * map.h), visible: new Uint8Array(map.w * map.h),
    units: [], nextId: 1, selectedId: null,
    ui: { mode: 'idle', reachable: null, targets: null, summonKind: null, inspectId: null },
    log: [], wandererSpawned: false,
    ...extra,
  };
}

export function addHero(state, kind, x, y, patch = {}) {
  const u = Object.assign(createHero(state.nextId++, kind, x, y), patch);
  state.units.push(u);
  return u;
}

export function addEnemy(state, kind, x, y, lv = 1, patch = {}) {
  const u = Object.assign(createEnemy(state.nextId++, kind, lv, x, y), patch);
  state.units.push(u);
  return u;
}

export function addSummon(state, kind, summoner, x, y, patch = {}) {
  const u = Object.assign(createSummon(state.nextId++, kind, summoner, x, y), patch);
  state.units.push(u);
  return u;
}
