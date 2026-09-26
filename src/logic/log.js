import { CONFIG } from '../config.js';

// 直近の出来事を記録する（最新 CONFIG.log.keep 件）
export function addLog(state, msg) {
  state.log.push(msg);
  if (state.log.length > CONFIG.log.keep) state.log.splice(0, state.log.length - CONFIG.log.keep);
}
