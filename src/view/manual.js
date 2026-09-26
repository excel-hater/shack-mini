// 簡易マニュアル（設定ダイアログから開く）。数値は CONFIG から読むので、調整しても食い違わない。

import { CONFIG } from '../config.js';

const SUMMON_ROLE = {
  石像: '動かない壁。通路をふさぐ',
  猟犬: '足が速い。先の部屋を偵察',
  戦士: '攻撃役',
  癒し手: '隣の味方を回復',
};

const swatch = (color, label, extra = '') =>
  `<li><span class="sw" style="background:${color}${extra}"></span>${label}</li>`;

export function manualHtml() {
  const sp = CONFIG.spawn;
  const summons = Object.values(CONFIG.summons)
    .map((s) => `<tr><td>${s.name}</td><td>MP${s.mp}</td><td>${SUMMON_ROLE[s.name] ?? ''}</td></tr>`)
    .join('');
  return `
    <div class="dialog manual" role="dialog" aria-label="遊び方">
      <h2>遊び方</h2>

      <h3>目的</h3>
      <p>バラバラに落ちた <b>A・B</b> のどちらか1人が階段 <span class="stairs">▼</span> に乗って「降りる」を選べば、2人そろって次の階へ。
      2人とも倒れたら1階からやり直し。<b>どこまで深く行けるか</b>がスコア。</p>

      <h3>1ターンの流れ</h3>
      <ol>
        <li>味方を1体ずつ、<b>移動 → 行動</b>（攻撃・召喚・回復・降りる・待機）</li>
        <li>行動すると次の味方が自動で選ばれる</li>
        <li>全員が終わると<b>敵のターン</b>（タップで早送り）</li>
      </ol>
      <p class="hint">迷ったら、マップ上端の<b>案内帯</b>を見ればOK。</p>

      <h3>操作</h3>
      <ul>
        <li>味方をタップ（または下のA・Bのチップ）で選ぶ</li>
        <li>青いマスで移動。自分のマスをタップで、移動せずに行動へ</li>
        <li><b>赤い敵をタップするだけで攻撃</b>。数字は予測ダメージ、✕は倒せる印</li>
        <li>移動のやり直しは「戻す」（行動する前だけ）</li>
        <li>敵をタップすると、その敵が次に届く範囲が赤く出る</li>
        <li>ドラッグでマップを動かす。「全体マップ」で全体を見る</li>
      </ul>

      <h3>色の見方</h3>
      <ul class="legend">
        ${swatch('rgba(60,130,255,0.8)', '移動できるマス')}
        ${swatch('rgba(255,50,50,0.8)', '攻撃できる敵')}
        ${swatch('rgba(60,220,90,0.8)', '召喚できるマス')}
        ${swatch('rgba(80,220,255,0.8)', '回復できる味方')}
        ${swatch('#d8b43a', '階段')}
        ${swatch('#3b7dff', 'まだ行動していない味方', ';box-shadow:0 0 0 2px #fff inset;border-radius:50%')}
        ${swatch('#5b6270', '行動済みの味方（「済」）', ';border-radius:50%')}
        ${swatch('rgba(255,70,70,0.35)', '調べた敵が次に届く範囲')}
      </ul>

      <h3>A と B</h3>
      <ul>
        <li><b>A</b>：近接（射程1）。HPが高く、通路をふさいで殴る役</li>
        <li><b>B</b>：射程2〜3。HPは低いがMPが多く、召喚が得意</li>
      </ul>

      <h3>召喚（1人${CONFIG.summon.maxPerSummoner}体まで・階段を降りると消える）</h3>
      <table>${summons}</table>

      <h3>知っておくこと</h3>
      <ul>
        <li>EXPは<b>敵を倒した本人</b>だけに入る（召喚が倒したら召喚者へ）</li>
        <li>倒れた方は、もう1人が降りれば<b>次の階でHP${CONFIG.reviveHp}で復活</b></li>
        <li>降りるとMPが最大値の${Math.round(CONFIG.mp.onDescendRatio * 100)}%回復。敵を倒すとMP+${CONFIG.mp.onKill}</li>
        <li>長居は危険：${sp.reinforceEvery}ターンごとに増援、${sp.wandererTurn}ターン目に強敵「徘徊者」</li>
        <li>急ぎすぎると育たない。<b>稼ぐか、降りるか</b>を毎階で決めよう</li>
      </ul>

      <div class="buttons">
        <button type="button" data-action="backToSettings">設定に戻る</button>
        <button type="button" data-action="closeSettings">閉じる</button>
      </div>
    </div>`;
}
