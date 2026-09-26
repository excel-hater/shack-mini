// マップ生成（5-1）とタイル判定。
// マップを cellsX×cellsY のセルに分け、各セルに部屋か中継点を置き、隣接セル同士をL字の通路で結ぶ。

export const TILE = { WALL: 0, FLOOR: 1, STAIRS: 2 };

export function idx(map, x, y) {
  return y * map.w + x;
}

export function inBounds(map, x, y) {
  return x >= 0 && y >= 0 && x < map.w && y < map.h;
}

export function tileAt(map, x, y) {
  return inBounds(map, x, y) ? map.tiles[idx(map, x, y)] : TILE.WALL;
}

export function isFloor(map, x, y) {
  return tileAt(map, x, y) !== TILE.WALL;
}

export function roomIdAt(map, x, y) {
  return inBounds(map, x, y) ? map.roomIdAt[idx(map, x, y)] : -1;
}

export function roomCenter(room) {
  return { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
}

export function roomTiles(room) {
  const out = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) out.push({ x, y });
  }
  return out;
}

// すべての床が1つにつながっているか
export function isConnected(map) {
  const n = map.w * map.h;
  let start = -1;
  let floors = 0;
  for (let i = 0; i < n; i++) {
    if (map.tiles[i] !== TILE.WALL) {
      floors++;
      if (start < 0) start = i;
    }
  }
  if (start < 0) return false;
  const seen = new Uint8Array(n);
  const queue = [start];
  seen[start] = 1;
  let count = 0;
  while (queue.length) {
    const i = queue.pop();
    count++;
    const x = i % map.w;
    const y = (i - x) / map.w;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const j = idx(map, nx, ny);
      if (!seen[j] && map.tiles[j] !== TILE.WALL) {
        seen[j] = 1;
        queue.push(j);
      }
    }
  }
  return count === floors;
}

export const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function generateMap(rng, cfg) {
  let map = null;
  for (let attempt = 0; attempt < cfg.maxRetries; attempt++) {
    map = tryGenerate(rng, cfg);
    if (isConnected(map)) return map;
  }
  console.error(`マップ生成: ${cfg.maxRetries}回試しても床がつながらなかったため、最後の結果を使います`);
  return map;
}

function tryGenerate(rng, cfg) {
  const { w, h, cellsX, cellsY } = cfg;
  const cellW = Math.floor(w / cellsX);
  const cellH = Math.floor(h / cellsY);
  const map = {
    w, h,
    tiles: new Uint8Array(w * h),
    rooms: [],
    roomIdAt: new Int8Array(w * h).fill(-1),
    stairs: null,
  };

  const cellCount = cellsX * cellsY;
  const roomCount = Math.min(cellCount, rng.int(cfg.roomsMin, cfg.roomsMax));
  const roomCells = new Set(rng.shuffle([...Array(cellCount).keys()]).slice(0, roomCount));

  // 各セルの「中心」（通路をつなぐ点）
  const centers = [];
  for (let c = 0; c < cellCount; c++) {
    const cx0 = (c % cellsX) * cellW;
    const cy0 = Math.floor(c / cellsX) * cellH;
    if (roomCells.has(c)) {
      // セルの内側に1マス以上の余白を残す
      const rw = rng.int(cfg.roomW[0], Math.min(cfg.roomW[1], cellW - 2));
      const rh = rng.int(cfg.roomH[0], Math.min(cfg.roomH[1], cellH - 2));
      const room = {
        id: map.rooms.length,
        x: cx0 + rng.int(1, cellW - 1 - rw),
        y: cy0 + rng.int(1, cellH - 1 - rh),
        w: rw, h: rh,
      };
      map.rooms.push(room);
      for (const t of roomTiles(room)) {
        map.tiles[idx(map, t.x, t.y)] = TILE.FLOOR;
        map.roomIdAt[idx(map, t.x, t.y)] = room.id;
      }
      centers.push(roomCenter(room));
    } else {
      // 中継点（relaySize四方の床）。通路の曲がり角になる
      const s = cfg.relaySize;
      const rx = cx0 + rng.int(s, cellW - 2 * s);
      const ry = cy0 + rng.int(s, cellH - 2 * s);
      carveRect(map, rx, ry, s, s);
      centers.push({ x: rx, y: ry });
    }
  }

  // 隣接セル（横・縦）の辺から、ランダムな全域木＋ランダムな追加辺を選ぶ
  const edges = [];
  for (let c = 0; c < cellCount; c++) {
    const cx = c % cellsX;
    const cy = Math.floor(c / cellsX);
    if (cx + 1 < cellsX) edges.push([c, c + 1]);
    if (cy + 1 < cellsY) edges.push([c, c + cellsX]);
  }
  const parent = [...Array(cellCount).keys()];
  const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  for (const [a, b] of rng.shuffle(edges)) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent[ra] = rb;
      carveCorridor(map, rng, cfg, centers[a], centers[b]);
    } else if (rng.chance(cfg.extraEdgeChance)) {
      carveCorridor(map, rng, cfg, centers[a], centers[b]);
    }
  }

  // 外周1マスは必ず壁
  for (let x = 0; x < w; x++) {
    map.tiles[idx(map, x, 0)] = TILE.WALL;
    map.tiles[idx(map, x, h - 1)] = TILE.WALL;
  }
  for (let y = 0; y < h; y++) {
    map.tiles[idx(map, 0, y)] = TILE.WALL;
    map.tiles[idx(map, w - 1, y)] = TILE.WALL;
  }
  return map;
}

function carveRect(map, x, y, w, h) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (xx > 0 && yy > 0 && xx < map.w - 1 && yy < map.h - 1) {
        map.tiles[idx(map, xx, yy)] = TILE.FLOOR;
      }
    }
  }
}

// 2点をL字の通路で結ぶ。通路は幅 corridorWidth（進行方向と直角に掘る）
function carveCorridor(map, rng, cfg, from, to) {
  const cw = cfg.corridorWidth;
  // 幅の分だけ外周に食い込まないよう寄せる
  const clampX = (v) => Math.min(Math.max(v, 1), map.w - 1 - cw);
  const clampY = (v) => Math.min(Math.max(v, 1), map.h - 1 - cw);
  const a = { x: clampX(from.x), y: clampY(from.y) };
  const b = { x: clampX(to.x), y: clampY(to.y) };
  const corner = rng.chance(0.5) ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
  carveSegment(map, a, corner, cw);
  carveSegment(map, corner, b, cw);
}

function carveSegment(map, p, q, cw) {
  const x0 = Math.min(p.x, q.x);
  const y0 = Math.min(p.y, q.y);
  if (p.y === q.y) carveRect(map, x0, p.y, Math.abs(p.x - q.x) + cw, cw);
  else carveRect(map, p.x, y0, cw, Math.abs(p.y - q.y) + cw);
}
