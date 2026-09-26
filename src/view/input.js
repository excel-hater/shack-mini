// タップ／クリック → game.js の操作関数を呼ぶ。ドラッグでカメラを動かす。

import { CONFIG } from '../config.js';

export function createInput({ canvas, renderer, getState, refresh }) {
  let down = null; // { x, y, lastX, lastY, dragging }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    down = { x: e.offsetX, y: e.offsetY, lastX: e.offsetX, lastY: e.offsetY, dragging: false };
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    if (!down.dragging && Math.hypot(e.offsetX - down.x, e.offsetY - down.y) >= CONFIG.dragThreshold) {
      down.dragging = true;
    }
    if (down.dragging && !renderer.view.overview) {
      renderer.panBy(e.offsetX - down.lastX, e.offsetY - down.lastY);
      refresh();
    }
    down.lastX = e.offsetX;
    down.lastY = e.offsetY;
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const wasDrag = down.dragging;
    down = null;
    if (!wasDrag) tap(renderer.screenToTile(e.offsetX, e.offsetY));
  });

  canvas.addEventListener('pointercancel', () => { down = null; });

  function tap(p) {
    const state = getState();
    // 全体マップ中のタップは、その地点へカメラを移して通常表示に戻すだけ
    if (renderer.view.overview) {
      renderer.view.overview = false;
      renderer.centerOn(p.x, p.y);
      refresh();
      return;
    }
    if (p.x < 0 || p.y < 0 || p.x >= state.map.w || p.y >= state.map.h) return;
    refresh();
  }

  function handleAction(action) {
    if (action === 'overview') {
      renderer.view.overview = !renderer.view.overview;
    }
    refresh();
  }

  return { handleAction };
}
