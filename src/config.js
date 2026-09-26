// 数値設定。試作で遊んで詰める前提の仮の値。ロジック側に数値を直書きせず、ここで調整する。
// L はそのユニットのLv（召喚は召喚者のLv）。

export const CONFIG = {
  map: { w: 30, h: 20, cellsX: 3, cellsY: 2, roomsMin: 4, roomsMax: 6,
         roomW: [5, 8], roomH: [5, 7], corridorWidth: 2, relaySize: 2,
         extraEdgeChance: 0.5, dropMinDistance: 15, maxRetries: 20 },

  vision: { corridorRadius: 2 },

  heroes: {
    A: { name: 'A', hp: 30, atk: 8, def: 4, mov: 4, range: [1, 1], mp: 4,
         grow: { hp: 5, atk: 2, def: 1, mp: 1 } },
    B: { name: 'B', hp: 20, atk: 7, def: 2, mov: 5, range: [2, 3], mp: 10,
         grow: { hp: 3, atk: 2, def: 1, mp: 2 } },
  },
  expToNext: (lv) => 10 * lv,
  regen: { everyTurns: 3, ratio: 0.05 },
  mp: { onKill: 1, onDescendRatio: 0.5 },
  reviveHp: 1,

  // 敵のLv：階層そのまま。10階以降+1、5の倍数の階層はさらに+1
  enemyLevel: (floor) => floor + (floor >= 10 ? 1 : 0) + (floor % 5 === 0 ? 1 : 0),
  enemies: {
    goblin:   (L) => ({ name: 'ゴブリン', hp: 8 + 4*L, atk: 4 + 2*L, def: 1 + L, mov: 4, range: [1, 1], exp: 3 + 2*L }),
    archer:   (L) => ({ name: '弓ゴブリン', hp: 6 + 3*L, atk: 4 + 2*L, def: L, mov: 3, range: [2, 3], exp: 3 + 2*L }),
    wanderer: (L) => ({ name: '徘徊者', hp: 2 * (8 + 4*(L+3)), atk: 4 + 2*(L+3), def: 1 + (L+3), mov: 5, range: [1, 1], exp: 3 * (3 + 2*(L+3)) }),
  },
  archerFromFloor: 3, archerChance: 0.3,
  spawn: { base: 4, perFloors: 3, detectRange: 8,
           reinforceEvery: 8, reinforceCount: [1, 2], wandererTurn: 40 },

  summon: { maxPerSummoner: 2, placeRange: 2 },
  summons: {
    statue:  { name: '石像',   mp: 3, make: (L) => ({ hp: 15 + 4*L, atk: 0, def: 3 + L, mov: 0, range: [1, 1], canAttack: false }) },
    hound:   { name: '猟犬',   mp: 2, make: (L) => ({ hp: 6 + L, atk: 2 + L, def: 0, mov: 7, range: [1, 1] }) },
    warrior: { name: '戦士',   mp: 5, make: (L) => ({ hp: 12 + 3*L, atk: 6 + 2*L, def: 2 + L, mov: 4, range: [1, 1] }) },
    healer:  { name: '癒し手', mp: 4, make: (L) => ({ hp: 8 + 2*L, atk: 0, def: 1, mov: 3, range: [1, 1], canAttack: false, heal: 4 + 2*L }) },
  },
  healRange: 1,
  log: { keep: 20, show: 3 },
  tileSize: 32,
  dragThreshold: 8,
  storageKey: 'shack-mini.best',
};
