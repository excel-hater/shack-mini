// 出来事（state.events）を短い演出で順番に見せる。
// 演出中は入力を止め、タップで残りを早送りする。ロジックの結果はすでに state に反映済みで、
// ここでは「何が起きたか」を上から重ねて見せるだけ。

import { CONFIG } from '../config.js';

export function createFx({ renderer, redraw, refresh, onFinish }) {
  const queue = [];
  let cur = null;   // { ev, dur, start }
  let raf = 0;
  let timer = 0;    // 次の出来事へ進むタイマー（rAF が止まる裏タブでも進むように setTimeout で進める）

  function duration(ev) {
    const d = CONFIG.fx;
    switch (ev.type) {
      case 'attack': return ev.side === 'enemy' ? d.enemyAttack : d.allyAttack;
      case 'heal': return d.heal;
      case 'levelup':
      case 'down': return d.popup;
      case 'enemyPhase':
      case 'playerPhase': return d.phaseBanner;
      case 'floor': return d.floorBanner;
      default: return 0;
    }
  }

  function enqueue(events) {
    for (const ev of events) {
      const dur = duration(ev);
      if (dur > 0) queue.push({ ev, dur });
    }
    if (!cur && queue.length) next();
  }

  function next() {
    clearTimeout(timer);
    cur = queue.shift() ?? null;
    if (!cur) {
      cancelAnimationFrame(raf);
      raf = 0;
      onFinish();
      return;
    }
    cur.start = performance.now();
    timer = setTimeout(next, cur.dur);
    // 敵の攻撃が画面外なら、攻撃された味方へカメラを寄せる
    if (cur.ev.type === 'attack' && cur.ev.side === 'enemy' && !renderer.isOnScreen(cur.ev.to)) {
      renderer.centerOn(cur.ev.to.x, cur.ev.to.y);
    }
    refresh();
    if (!raf) raf = requestAnimationFrame(tick);
  }

  // 描画だけを毎フレーム行う
  function tick() {
    raf = 0;
    if (!cur) return;
    redraw();
    raf = requestAnimationFrame(tick);
  }

  // 残りを飛ばす
  function skip() {
    queue.length = 0;
    cur = null;
    next();
  }

  function isBusy() {
    return cur !== null;
  }

  // 今の演出の見出し（案内帯に出す）
  function label() {
    if (!cur) return null;
    const pending = [cur, ...queue].map((s) => s.ev);
    if (cur.ev.type === 'floor') return `${cur.ev.floor}階`;
    if (pending.some((e) => e.type === 'enemyPhase' || e.side === 'enemy')) return '敵のターン';
    if (cur.ev.type === 'playerPhase') return `ターン${cur.ev.turn}`;
    return '味方の行動';
  }

  // 描画用：今の出来事と進み具合（0〜1）
  function frame() {
    if (!cur) return null;
    return { ev: cur.ev, p: Math.min(1, (performance.now() - cur.start) / cur.dur) };
  }

  return { enqueue, skip, isBusy, label, frame };
}
