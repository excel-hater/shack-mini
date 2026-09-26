// タップ／クリック → game.js の操作関数を呼ぶ。ドラッグでカメラを動かす。
// 選択中ユニットの操作モード（state.ui.mode）の切り替えもここで行う。

import { CONFIG } from '../config.js';
import * as G from '../logic/game.js';

export function createInput({ canvas, renderer, getState, getSettings, refresh, restart }) {
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

    // 直接タップ：赤い敵・水色の味方をタップするだけで攻撃・回復
    if (ui.quick && sel) {
      const t = has(ui.targets, p.x, p.y);
      if (t) {
        if (t.kind === 'attack') G.attack(state, sel.id, t.id);
        else G.heal(state, sel.id, t.id);
        afterOperation();
        return;
      }
    }

    // 攻撃・召喚・回復の対象選び。対象以外をタップしたら取り消し
    if (ui.mode === 'attack' || ui.mode === 'summon' || ui.mode === 'heal') {
      const t = has(ui.targets, p.x, p.y);
      if (t && ui.mode === 'attack') G.attack(state, sel.id, t.id);
      else if (t && ui.mode === 'summon') G.summon(state, sel.id, ui.summonKind, t.x, t.y);
      else if (t && ui.mode === 'heal') G.heal(state, sel.id, t.id);
      else G.selectUnit(state, sel.id);
      afterOperation();
      return;
    }

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
        afterOperation();
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
    afterOperation();
  }

  // 操作のあと：全員が行動済みなら自動でターン終了（設定ON時）
  function afterOperation() {
    const state = getState();
    if (getSettings().autoEndTurn && state.phase === 'player' && G.allActed(state)) {
      G.endPlayerPhase(state);
    }
    refresh();
  }

  // 移動前・行動選択中は、今の位置から攻撃・回復できる相手を最初から表示する（直接タップ）。
  // 描画の前に毎回呼ぶ
  function syncQuickTargets() {
    const state = getState();
    const ui = state.ui;
    const base = ui.mode === 'move' || ui.mode === 'action';
    if (base && getSettings().tapToAct && state.phase === 'player' && state.selectedId != null) {
      const id = state.selectedId;
      ui.targets = [
        ...G.getAttackTargets(state, id).map((t) => ({ ...t, kind: 'attack' })),
        ...G.getHealTargets(state, id).map((t) => ({ ...t, kind: 'heal' })),
      ];
      ui.quick = true;
    } else if (ui.quick) {
      if (base) ui.targets = null;
      ui.quick = false;
    }
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
      case 'selectHero':
        G.selectUnit(state, Number(arg));
        break;
      case 'next':
        G.selectNextUnit(state);
        break;
      case 'end':
        G.endPlayerPhase(state);
        break;
      case 'attack':
        state.ui = { ...state.ui, mode: 'attack', reachable: null, targets: G.getAttackTargets(state, id) };
        break;
      case 'summonMenu':
        state.ui = { ...state.ui, mode: 'summonPick', reachable: null, targets: null };
        break;
      case 'summonKind':
        if (!G.canSummon(state, id, arg)) break;
        state.ui = { ...state.ui, mode: 'summon', summonKind: arg, targets: G.getSummonTiles(state, id) };
        break;
      case 'heal':
        state.ui = { ...state.ui, mode: 'heal', reachable: null, targets: G.getHealTargets(state, id) };
        break;
      case 'descend':
        G.descend(state, id);
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
    afterOperation();
  }

  return { handleAction, syncQuickTargets };
}

// 選択中のユニットに応じた行動ボタン
export function actionButtons(state) {
  if (state.phase !== 'player') return [];
  const u = G.getUnit(state, state.selectedId);
  if (!u || u.down || u.side !== 'ally' || u.acted) return [];
  const ui = state.ui;
  if (ui.mode === 'summonPick') {
    const tiles = G.getSummonTiles(state, u.id).length > 0;
    return [
      ...G.SUMMON_KINDS.map((k) => ({
        action: 'summonKind', arg: k,
        label: CONFIG.summons[k].name, sub: `MP${CONFIG.summons[k].mp}`,
        disabled: !tiles || !G.canSummon(state, u.id, k),
      })),
      { action: 'cancel', label: 'やめる' },
    ];
  }
  if (ui.mode !== 'move' && ui.mode !== 'action') {
    return [{ action: 'cancel', label: 'やめる' }];
  }
  const list = [];
  if (u.canAttack && G.getAttackTargets(state, u.id).length) list.push({ action: 'attack', label: '攻撃' });
  if (u.kind === 'A' || u.kind === 'B') list.push({ action: 'summonMenu', label: '召喚' });
  if (G.getHealTargets(state, u.id).length) list.push({ action: 'heal', label: '回復' });
  if (G.canDescend(state, u.id)) list.push({ action: 'descend', label: '降りる' });
  list.push({ action: 'wait', label: '待機' });
  if (u.moved) list.push({ action: 'undo', label: '戻す' });
  return list;
}
