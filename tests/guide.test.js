import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideText } from '../src/view/guide.js';
import { selectUnit } from '../src/logic/game.js';
import { computeVisibility } from '../src/logic/vision.js';
import { addEnemy, addHero, stateFrom } from './helpers.js';

const OPEN = ['##########', '#........#', '#........#', '#........#', '##########'];
const ROOM = [{ x: 1, y: 1, w: 8, h: 3 }];
const ON = { tapToAct: true };
const OFF = { tapToAct: false };

function setup() {
  const s = stateFrom(OPEN, ROOM);
  const a = addHero(s, 'A', 1, 1);
  const b = addHero(s, 'B', 8, 3);
  computeVisibility(s);
  selectUnit(s, a.id);
  return { s, a, b };
}

test('移動前は移動先を案内し、選択ユニットのバッジを出す', () => {
  const { s } = setup();
  const g = guideText(s, ON);
  assert.equal(g.text, '移動先（青）をタップ');
  assert.equal(g.who.text, 'A');
});

test('攻撃できる敵がいると、直接タップONなら攻撃も案内する', () => {
  const { s, a } = setup();
  addEnemy(s, 'goblin', 2, 1);
  computeVisibility(s);
  selectUnit(s, a.id);
  assert.equal(guideText(s, ON).text, '青で移動／赤い敵で攻撃');
  assert.equal(guideText(s, OFF).text, '移動先（青）をタップ');
});

test('モードごとの案内', () => {
  const { s } = setup();
  s.ui.mode = 'attack';
  assert.equal(guideText(s, ON).text, '攻撃する敵（赤）をタップ');
  s.ui.mode = 'summon';
  assert.equal(guideText(s, ON).text, '召喚する場所（緑）をタップ');
  s.ui.mode = 'summonPick';
  assert.equal(guideText(s, ON).text, '召喚するものを選ぶ');
  s.units[0].mp = 0;
  assert.equal(guideText(s, ON).text, 'MPが足りません');
  s.ui.mode = 'action';
  assert.equal(guideText(s, ON).text, '行動を選んでください');
});

test('階段の上では降りるを案内する', () => {
  const { s, a } = setup();
  s.map.tiles[1 * s.map.w + 1] = 2;
  selectUnit(s, a.id);
  assert.equal(guideText(s, ON).text, '『降りる』で次の階へ');
});

test('全員行動済み・演出中・ゲームオーバー', () => {
  const { s } = setup();
  for (const u of s.units) u.acted = true;
  s.selectedId = null;
  assert.equal(guideText(s, ON).text, 'ターン終了を押してください');
  assert.equal(guideText(s, ON, '敵のターン').text, '敵のターン（タップで早送り）');
  s.phase = 'gameover';
  assert.equal(guideText(s, ON), null);
});

test('案内文は短い（20字前後まで）', () => {
  const { s } = setup();
  for (const mode of ['move', 'action', 'attack', 'summon', 'summonPick', 'heal']) {
    s.ui.mode = mode;
    const g = guideText(s, ON);
    assert.ok(g.text.length <= 20, `${mode}: ${g.text}`);
  }
});
