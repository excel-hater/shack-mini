import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/logic/rng.js';

test('同じシードなら同じ乱数列になる', () => {
  const a = createRng(12345);
  const b = createRng(12345);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('違うシードなら違う乱数列になる', () => {
  const a = createRng(1);
  const b = createRng(2);
  const sa = Array.from({ length: 10 }, () => a.next());
  const sb = Array.from({ length: 10 }, () => b.next());
  assert.notDeepEqual(sa, sb);
});

test('int は範囲内の整数を返す', () => {
  const r = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r.int(3, 6);
    assert.ok(Number.isInteger(v) && v >= 3 && v <= 6);
  }
});
