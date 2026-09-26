import { CONFIG } from '../config.js';

// 直近の出来事を記録する（最新 CONFIG.log.keep 件）。
// side：'ally'＝味方の行動、'enemy'＝敵の行動や味方に不利な出来事、'system'＝進行
export function addLog(state, text, side = 'system') {
  state.log.push({ text, side, floor: state.floor, turn: state.floorTurn });
  if (state.log.length > CONFIG.log.keep) state.log.splice(0, state.log.length - CONFIG.log.keep);
}

// 画面の演出用に「何が起きたか」を記録する。view が取り出して再生する
export function pushEvent(state, ev) {
  if (!state.events) state.events = [];
  state.events.push(ev);
}
