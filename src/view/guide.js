// 「次に何をするか」の案内文。1行・短く・一度に1つだけ。DOM に触れない。

import * as G from '../logic/game.js';
import { unitColor, unitMark } from './marks.js';

const badge = (u) => ({ text: unitMark(u), color: unitColor(u) });

// playing：演出中ならその見出し（例「敵のターン」）。戻り値 { who, text, tone } または null
export function guideText(state, settings, playing = null) {
  if (state.phase === 'gameover') return null;
  if (playing) return { who: null, text: `${playing}（タップで早送り）`, tone: 'enemy' };

  const inspect = state.ui.inspectId != null ? G.getUnit(state, state.ui.inspectId) : null;
  if (inspect && !inspect.down) {
    return { who: badge(inspect), text: `${inspect.name}：赤い範囲に届く`, tone: 'enemy' };
  }

  const u = G.getUnit(state, state.selectedId);
  if (!u || u.down) {
    if (G.allActed(state)) return { who: null, text: 'ターン終了を押してください', tone: 'done' };
    return { who: null, text: '味方をタップして選択', tone: 'info' };
  }
  const who = badge(u);
  const say = (text, tone = 'info') => ({ who, text, tone });
  if (u.acted) return say('行動済み。他の味方を選択', 'done');

  const quickAttack = settings.tapToAct && u.canAttack && G.getAttackTargets(state, u.id).length > 0;
  const quickHeal = settings.tapToAct && G.getHealTargets(state, u.id).length > 0;

  switch (state.ui.mode) {
    case 'attack':
      return say('攻撃する敵（赤）をタップ');
    case 'heal':
      return say('回復する味方（水色）をタップ');
    case 'summon':
      return say('召喚する場所（緑）をタップ');
    case 'summonPick': {
      if (!G.getSummonTiles(state, u.id).length) return say('召喚できる場所がありません');
      const any = G.SUMMON_KINDS.some((k) => G.canSummon(state, u.id, k));
      return say(any ? '召喚するものを選ぶ' : 'MPが足りません');
    }
    case 'move': {
      if (G.canDescend(state, u.id)) return say('『降りる』で次の階へ');
      const canMove = state.ui.reachable?.length > 0;
      if (canMove && quickAttack) return say('青で移動／赤い敵で攻撃');
      if (canMove && quickHeal) return say('青で移動／水色で回復');
      if (canMove) return say('移動先（青）をタップ');
      return say(quickAttack ? '赤い敵をタップで攻撃' : '行動を選んでください');
    }
    default:
      if (G.canDescend(state, u.id)) return say('『降りる』で次の階へ');
      if (quickAttack) return say('赤い敵をタップで攻撃');
      if (quickHeal) return say('水色の味方をタップで回復');
      return say('行動を選んでください');
  }
}
