// タップ／クリック → game.js の操作関数を呼ぶ。ドラッグでカメラを動かす。
// 選択中ユニットの操作モード（state.ui.mode）の切り替えもここで行う。

import { CONFIG } from '../config.js';
import * as G from '../logic/game.js';

export function createInput({ canvas, renderer, getState, refresh, restart }) {
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

  const has = (list, x, y) => list?.find((p) => p.x === x && p.y === y);

  function tap(p) {
    const state = getState();
    // 全体マップ中のタップは、その地点へカメラを移して通常表示に戻すだけ
    if (renderer.view.overview) {
      renderer.view.overview = false;
      renderer.centerOn(p.x, p.y);
      refresh();
      return;
    }
    if (state.phase !== 'player') return;
    if (p.x < 0 || p.y < 0 || p.x >= state.map.w || p.y >= state.map.h) return;
    const ui = state.ui;
    const sel = G.getUnit(state, state.selectedId);

    if (ui.mode === 'move' && sel) {
      if (sel.x === p.x && sel.y === p.y) {
        // 自分のマス → 移動せずに行動へ
        ui.mode = 'action';
        ui.reachable = null;
        refresh();
        return;
      }
      if (has(ui.reachable, p.x, p.y)) {
        G.moveUnit(state, sel.id, p.x, p.y);
        refresh();
        return;
      }
    }

    // ユニットの選択・敵の情報表示
    const u = G.unitAt(state, p.x, p.y);
    const visibleEnemy = u && u.side === 'enemy' && state.visible[p.y * state.map.w + p.x];
    if (u && u.side === 'ally') {
      G.selectUnit(state, u.id);
    } else if (visibleEnemy) {
      G.selectUnit(state, u.id);
    } else {
      ui.inspectId = null;
    }
    refresh();
  }

  function handleAction(action, arg) {
    const state = getState();
    const id = state.selectedId;
    switch (action) {
      case 'overview':
        renderer.view.overview = !renderer.view.overview;
        break;
      case 'restart':
        restart();
        return;
      case 'next':
        G.selectNextUnit(state);
        break;
      case 'end':
        G.endPlayerPhase(state);
        break;
      case 'wait':
        G.wait(state, id);
        break;
      case 'undo':
        G.cancelMove(state, id);
        break;
      case 'cancel':
        G.selectUnit(state, id);
        break;
    }
    refresh();
  }

  return { handleAction };
}

// 選択中のユニットに応じた行動ボタン
export function actionButtons(state) {
  if (state.phase !== 'player') return [];
  const u = G.getUnit(state, state.selectedId);
  if (!u || u.down || u.side !== 'ally' || u.acted) return [];
  const ui = state.ui;
  if (ui.mode !== 'move' && ui.mode !== 'action') {
    return [{ action: 'cancel', label: 'やめる' }];
  }
  const list = [];
  list.push({ action: 'wait', label: '待機' });
  if (u.moved) list.push({ action: 'undo', label: '戻す' });
  return list;
}
