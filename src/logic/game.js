// 状態遷移（フェイズ、階層移動、復活、増援、ゲームオーバー）。
// view から呼ぶ操作関数はすべてここに置く。ルール上できない操作は何もせず false を返す。

import { CONFIG } from '../config.js';
import { createRng } from './rng.js';
import { generateMap, idx, roomTiles, TILE } from './map.js';

export function newGame(seed, opts = {}) {
  const state = {
    seed,
    rng: createRng(seed),
    floor: 1,
    best: Math.max(1, opts.best ?? 1),
    floorTurn: 1,
    phase: 'player',
    map: null,
    seen: null,
    visible: null,
    units: [],
    nextId: 1,
    selectedId: null,
    ui: emptyUi(),
    log: [],
    wandererSpawned: false,
  };
  setupFloor(state);
  return state;
}

function emptyUi() {
  return { mode: 'idle', reachable: null, targets: null, summonKind: null, inspectId: null };
}

function setupFloor(state) {
  const { rng } = state;
  const map = generateMap(rng, CONFIG.map);
  state.map = map;
  const room = rng.pick(map.rooms);
  const t = rng.pick(roomTiles(room));
  map.tiles[idx(map, t.x, t.y)] = TILE.STAIRS;
  map.stairs = t;
}
