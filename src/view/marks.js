// ユニットの表示記号と色（マップ・案内帯・パネルで共通）

export const MARKS = {
  statue: '石', hound: '犬', warrior: '戦', healer: '癒',
  goblin: 'ゴ', archer: '弓', wanderer: '徘',
};

export function unitMark(u) {
  return MARKS[u.kind] ?? u.kind;
}

export function unitColor(u) {
  if (u.side === 'enemy') return u.kind === 'wanderer' ? '#9b4dff' : '#e04848';
  if (u.kind === 'A' || u.kind === 'B') return '#3b7dff';
  return '#2fb35a';
}
