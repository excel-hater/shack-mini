import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { manualHtml } from '../src/view/manual.js';

test('簡易マニュアルは召喚の種類とMPを config どおりに載せる', () => {
  const html = manualHtml();
  for (const s of Object.values(CONFIG.summons)) {
    assert.ok(html.includes(`<td>${s.name}</td><td>MP${s.mp}</td>`), s.name);
  }
  assert.ok(html.includes(`${CONFIG.spawn.reinforceEvery}ターンごとに増援`));
  assert.ok(html.includes(`${CONFIG.spawn.wandererTurn}ターン目`));
  assert.ok(html.includes('data-action="backToSettings"'));
  assert.ok(html.includes('data-action="closeSettings"'));
});
