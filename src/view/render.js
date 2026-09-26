// Canvas描画とカメラ。毎回 state を読んで丸ごと描き直す。

import { CONFIG } from '../config.js';
import { TILE } from '../logic/map.js';

const COLORS = {
  floorVisible: '#8f959c',
  floorSeen: '#43474d',
  wallVisible: '#2c3037',
  wallSeen: '#1a1c20',
  gridLine: 'rgba(0,0,0,0.25)',
  stairs: '#ffd23f',
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
        ctx.fillStyle = vis ? COLORS.floorVisible : COLORS.floorSeen;
        ctx.fillRect(x * ts, y * ts, ts, ts);
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(x * ts + 0.5, y * ts + 0.5, ts - 1, ts - 1);
        if (t === TILE.STAIRS) {
          ctx.fillStyle = vis ? COLORS.stairs : '#8a7424';
          ctx.font = `bold ${ts * 0.7}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('▼', x * ts + ts / 2, y * ts + ts / 2 + 1);
        }
      }
    }
  }

  function drawHighlights(state) {
    const ui = state.ui;
    if (!ui) return;
    if (ui.reachable) {
      ctx.fillStyle = 'rgba(60,130,255,0.40)';
      for (const p of ui.reachable) ctx.fillRect(p.x * ts, p.y * ts, ts, ts);
    }
    if (ui.targets) {
      ctx.fillStyle = {
        attack: 'rgba(255,60,60,0.45)',
        summon: 'rgba(60,220,90,0.45)',
        heal: 'rgba(80,220,255,0.45)',
      }[ui.mode] ?? 'rgba(255,255,255,0.3)';
      for (const p of ui.targets) ctx.fillRect(p.x * ts, p.y * ts, ts, ts);
    }
  }

  function unitColor(u) {
    if (u.side === 'enemy') return u.kind === 'wanderer' ? '#9b4dff' : '#e04848';
    if (u.kind === 'A' || u.kind === 'B') return '#3b7dff';
    return '#2fb35a';
  }

  const MARKS = {
    statue: '石', hound: '犬', warrior: '戦', healer: '癒',
    goblin: 'ゴ', archer: '弓', wanderer: '徘',
  };

  function drawUnits(state) {
    for (const u of state.units) {
      if (u.down) continue;
      if (u.side === 'enemy' && !visAt(state, u.y * state.map.w + u.x)) continue;
      const cx = u.x * ts + ts / 2;
      const cy = u.y * ts + ts / 2 - 2;
      const r = ts * 0.38;
      ctx.globalAlpha = u.side === 'ally' && u.acted ? 0.45 : 1;
      ctx.fillStyle = unitColor(u);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${ts * 0.42}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(MARKS[u.kind] ?? u.kind, cx, cy + 1);
      // HPバー
      const bw = ts - 6;
      const bx = u.x * ts + 3;
      const by = u.y * ts + ts - 5;
      ctx.fillStyle = '#300';
      ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = u.side === 'enemy' ? '#ff6b6b' : '#5dff7a';
      ctx.fillRect(bx, by, bw * Math.max(0, u.hp) / u.maxHp, 3);
      ctx.globalAlpha = 1;
      if (u.id === state.selectedId || u.id === state.ui?.inspectId) {
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 2;
        ctx.strokeRect(u.x * ts + 1, u.y * ts + 1, ts - 2, ts - 2);
      }
    }
  }

  // 攻撃対象の上に予測ダメージを出す
  function drawPredictions(state) {
    const ui = state.ui;
    if (!ui || ui.mode !== 'attack' || !ui.targets) return;
    ctx.font = `bold ${ts * 0.38}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of ui.targets) {
      if (t.damage == null) continue;
      const label = t.lethal ? `-${t.damage}✕` : `-${t.damage}`;
      const x = t.x * ts + ts / 2;
      const y = t.y * ts + 6;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.strokeText(label, x, y);
      ctx.fillStyle = '#ffec6b';
      ctx.fillText(label, x, y);
    }
  }

  return { view, resize, draw, centerOn, panBy, screenToTile };
}
