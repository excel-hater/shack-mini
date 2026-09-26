// Canvas描画とカメラ。毎回 state を読んで丸ごと描き直す。

import { CONFIG } from '../config.js';
import { TILE } from '../logic/map.js';
import { unitColor, unitMark } from './marks.js';
import * as G from '../logic/game.js';

const COLORS = {
  floorVisible: '#8f959c',
  floorSeen: '#43474d',
  wallVisible: '#2c3037',
  wallSeen: '#1a1c20',
  gridLine: 'rgba(0,0,0,0.25)',
  stairsTile: '#d8b43a',
  stairsTileSeen: '#6b5a22',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const ts = CONFIG.tileSize;
  const view = {
    camX: 0, camY: 0,   // 通常表示でのカメラ左上（ワールド座標px）
    overview: false,
    vw: 0, vh: 0,       // CSSピクセルでの表示サイズ
    map: null,
  };

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    view.vw = canvas.clientWidth;
    view.vh = canvas.clientHeight;
    canvas.width = Math.round(view.vw * dpr);
    canvas.height = Math.round(view.vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    clampCamera();
  }

  function clampAxis(v, mapPx, viewPx) {
    if (mapPx <= viewPx) return (mapPx - viewPx) / 2;
    return Math.min(Math.max(v, 0), mapPx - viewPx);
  }

  function clampCamera() {
    if (!view.map) return;
    view.camX = clampAxis(view.camX, view.map.w * ts, view.vw);
    view.camY = clampAxis(view.camY, view.map.h * ts, view.vh);
  }

  function centerOn(x, y) {
    view.camX = x * ts + ts / 2 - view.vw / 2;
    view.camY = y * ts + ts / 2 - view.vh / 2;
    clampCamera();
  }

  function panBy(dx, dy) {
    view.camX -= dx;
    view.camY -= dy;
    clampCamera();
  }

  // 表示倍率と描画原点（全体マップ時は縮小して中央寄せ）
  function transform() {
    if (view.overview && view.map) {
      const s = Math.min(view.vw / (view.map.w * ts), view.vh / (view.map.h * ts));
      return {
        s,
        ox: (view.vw - view.map.w * ts * s) / 2,
        oy: (view.vh - view.map.h * ts * s) / 2,
      };
    }
    return { s: 1, ox: -view.camX, oy: -view.camY };
  }

  function screenToTile(px, py) {
    const { s, ox, oy } = transform();
    return { x: Math.floor((px - ox) / s / ts), y: Math.floor((py - oy) / s / ts) };
  }

  function draw(state) {
    const map = state.map;
    if (view.map !== map) {
      view.map = map;
      clampCamera();
    }
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, view.vw, view.vh);
    const { s, ox, oy } = transform();
    ctx.translate(ox, oy);
    ctx.scale(s, s);
    drawTiles(state);
    drawHighlights(state);
    drawUnits(state);
    drawPredictions(state);
    ctx.restore();
  }

  // visible / seen がまだ無い（霧なし）ときは全体を見えている扱いにする
  const visAt = (state, i) => (state.visible ? state.visible[i] === 1 : true);
  const seenAt = (state, i) => (state.seen ? state.seen[i] === 1 : true);

  function drawTiles(state) {
    const map = state.map;
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const i = y * map.w + x;
        const vis = visAt(state, i);
        if (!vis && !seenAt(state, i)) continue;
        const t = map.tiles[i];
        if (t === TILE.WALL) {
          ctx.fillStyle = vis ? COLORS.wallVisible : COLORS.wallSeen;
          ctx.fillRect(x * ts, y * ts, ts, ts);
          continue;
        }
        if (t === TILE.STAIRS) {
          // 階段はマスごと黄色くして目立たせる
          ctx.fillStyle = vis ? COLORS.stairsTile : COLORS.stairsTileSeen;
          ctx.fillRect(x * ts, y * ts, ts, ts);
          ctx.fillStyle = vis ? '#3a2c00' : '#1e1700';
          ctx.font = `bold ${ts * 0.62}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('▼', x * ts + ts / 2, y * ts + ts / 2 + 1);
          continue;
        }
        ctx.fillStyle = vis ? COLORS.floorVisible : COLORS.floorSeen;
        ctx.fillRect(x * ts, y * ts, ts, ts);
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(x * ts + 0.5, y * ts + 0.5, ts - 1, ts - 1);
      }
    }
  }

  const TARGET_STYLE = {
    attack: { fill: 'rgba(255,50,50,0.50)', stroke: '#ff4040' },
    summon: { fill: 'rgba(60,220,90,0.50)', stroke: '#3ddc62' },
    heal: { fill: 'rgba(80,220,255,0.50)', stroke: '#50dcff' },
  };

  function tileBox(p, fill, stroke, lw = 2) {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(p.x * ts, p.y * ts, ts, ts);
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.strokeRect(p.x * ts + lw / 2, p.y * ts + lw / 2, ts - lw, ts - lw);
    }
  }

  function drawHighlights(state) {
    const ui = state.ui;
    if (!ui) return;
    // 調査中の敵：次の敵ターンで動ける範囲（濃い赤）と攻撃が届く範囲（薄い赤）
    if (ui.inspectId != null) {
      const th = G.getThreatTiles(state, ui.inspectId);
      for (const p of th.move) tileBox(p, 'rgba(255,70,70,0.30)');
      for (const p of th.attack) tileBox(p, 'rgba(255,70,70,0.14)', 'rgba(255,90,90,0.5)', 1);
    }
    // 選択中のマス
    const sel = G.getUnit(state, state.selectedId);
    if (sel && !sel.down) tileBox(sel, 'rgba(255,210,63,0.40)');
    if (ui.reachable) {
      for (const p of ui.reachable) tileBox(p, 'rgba(60,130,255,0.55)', 'rgba(170,205,255,0.85)', 1);
    }
    if (ui.targets) {
      for (const p of ui.targets) {
        const st = TARGET_STYLE[p.kind ?? ui.mode] ?? { fill: 'rgba(255,255,255,0.3)' };
        tileBox(p, st.fill, st.stroke, 3);
      }
    }
  }

  function hpColor(ratio) {
    if (ratio > 0.5) return '#4ade80';
    if (ratio > 0.25) return '#facc15';
    return '#f87171';
  }

  function drawUnits(state) {
    for (const u of state.units) {
      if (u.down) continue;
      if (u.side === 'enemy' && !visAt(state, u.y * state.map.w + u.x)) continue;
      const cx = u.x * ts + ts / 2;
      const cy = u.y * ts + ts / 2 - 2;
      const r = ts * 0.36;
      const done = u.side === 'ally' && u.acted;
      ctx.fillStyle = done ? '#5b6270' : unitColor(u);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      // 外周：未行動の味方は白いリング、敵は暗いリング
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = u.side === 'enemy' ? '#300' : done ? '#3a3f48' : '#fff';
      ctx.stroke();
      ctx.fillStyle = done ? '#c8ccd4' : '#fff';
      ctx.font = `bold ${ts * 0.42}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(unitMark(u), cx, cy + 1);
      if (done) {
        // 行動済みの印
        ctx.fillStyle = '#23262d';
        ctx.beginPath();
        ctx.arc(u.x * ts + ts - 7, u.y * ts + 7, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e5e7eb';
        ctx.font = `bold ${ts * 0.3}px sans-serif`;
        ctx.fillText('済', u.x * ts + ts - 7, u.y * ts + 7.5);
      }
      // HPバー（割合で緑・黄・赤）
      const ratio = Math.max(0, u.hp) / u.maxHp;
      const bw = ts - 4;
      const bx = u.x * ts + 2;
      const by = u.y * ts + ts - 6;
      ctx.fillStyle = '#111';
      ctx.fillRect(bx, by, bw, 5);
      ctx.fillStyle = hpColor(ratio);
      ctx.fillRect(bx + 1, by + 1, (bw - 2) * ratio, 3);
      if (u.id === state.selectedId || u.id === state.ui?.inspectId) {
        ctx.strokeStyle = u.side === 'enemy' ? '#ff6b6b' : '#ffd23f';
        ctx.lineWidth = 3;
        ctx.strokeRect(u.x * ts + 1.5, u.y * ts + 1.5, ts - 3, ts - 3);
      }
    }
    // ▼は上のマスのユニットに隠れないよう最後に描く
    const sel = G.getUnit(state, state.selectedId);
    if (sel && !sel.down) drawPointer(sel.x * ts + ts / 2, sel.y * ts);
  }

  // 選択中ユニットの頭上の ▼
  function drawPointer(cx, top) {
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 7, top - 10);
    ctx.lineTo(cx + 7, top - 10);
    ctx.lineTo(cx, top - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // 攻撃対象の上に予測ダメージを出す（倒せるときは ✕）
  function drawPredictions(state) {
    const targets = state.ui?.targets;
    if (!targets) return;
    ctx.font = `bold ${ts * 0.4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of targets) {
      if (t.damage == null) continue;
      const label = t.lethal ? `-${t.damage}✕` : `-${t.damage}`;
      const x = t.x * ts + ts / 2;
      const y = t.y * ts - 4;
      const w = ctx.measureText(label).width + 8;
      ctx.fillStyle = t.lethal ? '#b91c1c' : '#111';
      ctx.fillRect(x - w / 2, y - 8, w, 16);
      ctx.fillStyle = '#ffec6b';
      ctx.fillText(label, x, y + 1);
    }
  }

  return { view, resize, draw, centerOn, panBy, screenToTile };
}
