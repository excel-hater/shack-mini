// 移動範囲（BFS）、経路距離、射程判定。

import { DIRS4, idx, inBounds, TILE } from './map.js';

export function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function inRange(from, to, rangeMin, rangeMax) {
  const d = manhattan(from, to);
  return d >= rangeMin && d <= rangeMax;
}

// マスごとのユニット（退場中を除く）。index = y*w + x
export function occupancy(map, units) {
  const occ = new Array(map.w * map.h).fill(null);
  for (const u of units) if (!u.down && u.x >= 0) occ[idx(map, u.x, u.y)] = u;
  return occ;
}

// 移動できるマスを求める（4方向、移動力の歩数まで）。
// 壁と相手側のユニットは通れない。同じ側のユニットは通り抜けられるが止まれない。
// 戻り値の stops には、動かない場合の現在地（d=0）も含む。
export function computeReachable(map, unit, units) {
  const occ = occupancy(map, units);
  const dist = new Int16Array(map.w * map.h).fill(-1);
  const start = idx(map, unit.x, unit.y);
  dist[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    if (dist[i] >= unit.mov) continue;
    const x = i % map.w;
    const y = (i - x) / map.w;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const j = idx(map, nx, ny);
      if (dist[j] >= 0 || map.tiles[j] === TILE.WALL) continue;
      const o = occ[j];
      if (o && o.side !== unit.side) continue;
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }
  const stops = [];
  for (const i of queue) {
    if (occ[i] && occ[i] !== unit) continue;
    const x = i % map.w;
    stops.push({ x, y: (i - x) / map.w, d: dist[i] });
  }
  return stops;
}

// 壁だけを避けた歩数（ユニットは無視）。届かないマスは -1
export function distanceField(map, from) {
  const dist = new Int16Array(map.w * map.h).fill(-1);
  const start = idx(map, from.x, from.y);
  dist[start] = 0;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % map.w;
    const y = (i - x) / map.w;
    for (const [dx, dy] of DIRS4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(map, nx, ny)) continue;
      const j = idx(map, nx, ny);
      if (dist[j] >= 0 || map.tiles[j] === TILE.WALL) continue;
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }
  return dist;
}
