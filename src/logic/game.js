// 状態遷移（フェイズ、階層移動、復活、増援、ゲームオーバー）。
// view から呼ぶ操作関数はすべてここに置く。ルール上できない操作は何もせず false を返す。

import { CONFIG } from '../config.js';
import { createRng } from './rng.js';
import { generateMap, idx, roomCenter, roomTiles, TILE } from './map.js';
import { computeReachable, inRange, manhattan, occupancy } from './path.js';
import { createEnemy, createHero, isHero } from './units.js';
import { computeVisibility } from './vision.js';
import { calcDamage, applyAttack } from './combat.js';
import { runEnemyPhase } from './ai.js';
import { addLog } from './log.js';

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
  state.units.push(createHero(state.nextId++, 'A', 0, 0));
  state.units.push(createHero(state.nextId++, 'B', 0, 0));
  setupFloor(state);
  addLog(state, `${state.floor}階に落ちた。A・Bは別々の場所にいる`);
  return state;
}

function emptyUi() {
  return { mode: 'idle', reachable: null, targets: null, summonKind: null, inspectId: null };
}

// ---------- 参照用の小さな関数 ----------

export function getUnit(state, id) {
  return state.units.find((u) => u.id === id) ?? null;
}

export function heroes(state) {
  return state.units.filter(isHero);
}

export function unitAt(state, x, y) {
  return state.units.find((u) => !u.down && u.x === x && u.y === y) ?? null;
}

function isOwnActive(state, id) {
  const u = getUnit(state, id);
  if (state.phase !== 'player' || !u || u.side !== 'ally' || u.down) return null;
  return u;
}

// ---------- 階層の生成 ----------

function setupFloor(state) {
  const { rng } = state;
  const map = generateMap(rng, CONFIG.map);
  state.map = map;
  state.seen = null;
  state.visible = null;

  // A・B：中心間のマンハッタン距離が dropMinDistance 以上の部屋の組から選ぶ
  const pairs = [];
  for (let i = 0; i < map.rooms.length; i++) {
    for (let j = i + 1; j < map.rooms.length; j++) {
      const d = manhattan(roomCenter(map.rooms[i]), roomCenter(map.rooms[j]));
      pairs.push({ i, j, d });
    }
  }
  const far = pairs.filter((p) => p.d >= CONFIG.map.dropMinDistance);
  const pair = far.length ? rng.pick(far) : pairs.reduce((a, b) => (b.d > a.d ? b : a));
  const [roomA, roomB] = rng.chance(0.5) ? [pair.i, pair.j] : [pair.j, pair.i];
  const [A, B] = heroes(state);
  for (const h of [A, B]) h.x = h.y = -1; // 前の階層の位置が配置の邪魔をしないように
  placeInRoom(state, A, map.rooms[roomA]);
  placeInRoom(state, B, map.rooms[roomB]);

  // 階段：A・Bの部屋以外の部屋
  const others = map.rooms.filter((r) => r.id !== roomA && r.id !== roomB);
  const stairs = rng.pick(roomTiles(rng.pick(others)));
  map.tiles[idx(map, stairs.x, stairs.y)] = TILE.STAIRS;
  map.stairs = stairs;

  // 敵：A・Bの部屋以外の部屋に置く
  const count = CONFIG.spawn.base + Math.floor(state.floor / CONFIG.spawn.perFloors);
  for (let k = 0; k < count; k++) spawnEnemy(state, rng.pick(others), 'goblin');

  state.floorTurn = 1;
  state.wandererSpawned = false;
  startPlayerPhase(state);
}

// 部屋の空いている床マスを1つ返す（なければ null）
function emptyTileInRoom(state, room, { avoidStairs = false } = {}) {
  const occ = occupancy(state.map, state.units);
  const free = roomTiles(room).filter((t) => {
    const i = idx(state.map, t.x, t.y);
    if (occ[i]) return false;
    if (avoidStairs && state.map.tiles[i] === TILE.STAIRS) return false;
    return state.map.tiles[i] !== TILE.WALL;
  });
  return free.length ? state.rng.pick(free) : null;
}

function placeInRoom(state, unit, room) {
  const t = emptyTileInRoom(state, room);
  unit.x = t.x;
  unit.y = t.y;
}

function spawnEnemy(state, room, kind) {
  const t = emptyTileInRoom(state, room, { avoidStairs: true });
  if (!t) return null;
  const e = createEnemy(state.nextId++, kind, CONFIG.enemyLevel(state.floor), t.x, t.y);
  state.units.push(e);
  return e;
}

// ---------- フェイズ ----------

function startPlayerPhase(state) {
  state.phase = 'player';
  for (const u of state.units) {
    if (u.side !== 'ally') continue;
    u.moved = false;
    u.acted = false;
    u.moveFrom = null;
  }
  computeVisibility(state);
  state.selectedId = null;
  state.ui = emptyUi();
  selectNextUnit(state);
}

export function endPlayerPhase(state) {
  if (state.phase !== 'player') return false;
  state.phase = 'enemy';
  state.ui = emptyUi();
  runEnemyPhase(state);
  if (state.phase === 'gameover') {
    state.selectedId = null;
    computeVisibility(state);
    return true;
  }
  state.floorTurn++;
  if (state.floorTurn % CONFIG.regen.everyTurns === 0) {
    for (const h of heroes(state)) {
      if (!h.down) h.hp = Math.min(h.maxHp, h.hp + Math.ceil(h.maxHp * CONFIG.regen.ratio));
    }
  }
  startPlayerPhase(state);
  return true;
}

// ---------- 選択 ----------

// 行動順：A → B → 召喚（配列順）
function actionOrder(state) {
  const allies = state.units.filter((u) => u.side === 'ally' && !u.down);
  return [...allies.filter(isHero).sort((a, b) => a.kind.localeCompare(b.kind)), ...allies.filter((u) => !isHero(u))];
}

export function allActed(state) {
  return actionOrder(state).every((u) => u.acted);
}

export function selectUnit(state, id) {
  const u = getUnit(state, id);
  if (state.phase !== 'player' || !u || u.down) return false;
  if (u.side === 'enemy') {
    state.ui.inspectId = id;
    return true;
  }
  state.selectedId = id;
  state.ui = emptyUi();
  if (u.acted) {
    state.ui.mode = 'idle';
  } else if (u.moved) {
    state.ui.mode = 'action';
  } else {
    state.ui.mode = 'move';
    state.ui.reachable = computeReachable(state.map, u, state.units).filter((p) => p.d > 0);
  }
  return true;
}

// 現在の選択の次にいる、まだ行動していない味方を選ぶ。いなければ選択を外す
export function selectNextUnit(state) {
  const order = actionOrder(state);
  const cur = order.findIndex((u) => u.id === state.selectedId);
  for (let k = 1; k <= order.length; k++) {
    const u = order[(cur + k + order.length) % order.length];
    if (!u.acted) return selectUnit(state, u.id);
  }
  state.selectedId = null;
  state.ui = emptyUi();
  return false;
}

// 行動後：A → B → 召喚の順で、まだ行動していない最初の味方を選ぶ
function afterAction(state) {
  computeVisibility(state);
  if (state.phase !== 'player') return;
  const next = actionOrder(state).find((u) => !u.acted);
  if (next) selectUnit(state, next.id);
  else {
    state.selectedId = null;
    state.ui = emptyUi();
  }
}

// ---------- 移動・待機 ----------

export function moveUnit(state, id, x, y) {
  const u = isOwnActive(state, id);
  if (!u || u.moved || u.acted) return false;
  const ok = computeReachable(state.map, u, state.units).some((p) => p.x === x && p.y === y && p.d > 0);
  if (!ok) return false;
  u.moveFrom = { x: u.x, y: u.y };
  u.x = x;
  u.y = y;
  u.moved = true;
  computeVisibility(state);
  state.selectedId = id;
  state.ui = { ...emptyUi(), mode: 'action' };
  return true;
}

export function cancelMove(state, id) {
  const u = isOwnActive(state, id);
  if (!u || !u.moved || u.acted || !u.moveFrom) return false;
  // TODO(仕様): 戻す前に見えた敵や地形は見えたまま（seen に残る）
  u.x = u.moveFrom.x;
  u.y = u.moveFrom.y;
  u.moveFrom = null;
  u.moved = false;
  computeVisibility(state);
  return selectUnit(state, id);
}

export function wait(state, id) {
  const u = isOwnActive(state, id);
  if (!u || u.acted) return false;
  u.moved = true;
  u.acted = true;
  afterAction(state);
  return true;
}

// ---------- 攻撃 ----------

// 攻撃できる敵（見えていて射程内）。予測ダメージつき
export function getAttackTargets(state, id) {
  const u = isOwnActive(state, id);
  if (!u || u.acted || !u.canAttack) return [];
  return state.units
    .filter((e) => e.side === 'enemy' && state.visible[idx(state.map, e.x, e.y)]
      && inRange(u, e, u.rangeMin, u.rangeMax))
    .map((e) => {
      const damage = calcDamage(u, e);
      return { x: e.x, y: e.y, id: e.id, damage, lethal: damage >= e.hp };
    });
}

export function attack(state, id, targetId) {
  const u = isOwnActive(state, id);
  if (!u || u.acted) return false;
  if (!getAttackTargets(state, id).some((t) => t.id === targetId)) return false;
  applyAttack(state, u, getUnit(state, targetId));
  u.moved = true;
  u.acted = true;
  afterAction(state);
  return true;
}

// ---------- 階段 ----------

export function canDescend(state, id) {
  const u = isOwnActive(state, id);
  if (!u || u.acted || !isHero(u)) return false;
  return state.map.tiles[idx(state.map, u.x, u.y)] === TILE.STAIRS;
}

// どちらかが降りれば、もう1人も位置に関係なく一緒に次の階層へ
export function descend(state, id) {
  if (!canDescend(state, id)) return false;
  const who = getUnit(state, id);
  state.floor++;
  state.best = Math.max(state.best, state.floor);
  addLog(state, `${who.name}が階段を降りた。${state.floor}階へ`);
  for (const h of heroes(state)) {
    if (h.down) {
      h.down = false;
      h.hp = CONFIG.reviveHp;
      addLog(state, `${h.name}がHP${h.hp}で復活した`);
    }
    h.mp = Math.min(h.maxMp, h.mp + Math.ceil(h.maxMp * CONFIG.mp.onDescendRatio));
  }
  // 召喚ユニットと敵は消える
  state.units = heroes(state);
  setupFloor(state);
  return true;
}
