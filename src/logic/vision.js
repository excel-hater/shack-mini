// 視界計算と探索済みの記録（5-3）。味方全員分の視界を合わせて visible にする。

import { CONFIG } from '../config.js';
import { idx, inBounds } from './map.js';

export function computeVisibility(state) {
  const map = state.map;
  const n = map.w * map.h;
  if (!state.visible || state.visible.length !== n) state.visible = new Uint8Array(n);
  if (!state.seen || state.seen.length !== n) state.seen = new Uint8Array(n);
  const vis = state.visible;
  vis.fill(0);

  const mark = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) if (inBounds(map, x, y)) vis[idx(map, x, y)] = 1;
    }
  };

  const r = CONFIG.vision.corridorRadius;
  for (const u of state.units) {
    if (u.side !== 'ally' || u.down) continue;
    const roomId = map.roomIdAt[idx(map, u.x, u.y)];
    if (roomId >= 0) {
      // 部屋の矩形＋外周1マス（壁と通路の入口）
      const room = map.rooms[roomId];
      mark(room.x - 1, room.y - 1, room.x + room.w, room.y + room.h);
    } else {
      // 通路：チェビシェフ距離 r 以内。壁による遮りは考えない
      mark(u.x - r, u.y - r, u.x + r, u.y + r);
    }
  }
  for (let i = 0; i < n; i++) if (vis[i]) state.seen[i] = 1;
}

export function isVisible(state, x, y) {
  return state.visible[idx(state.map, x, y)] === 1;
}
