import { randomSeed } from './logic/rng.js';

function readSeed() {
  const v = Number(new URLSearchParams(location.search).get('seed'));
  return Number.isInteger(v) && v > 0 ? v : randomSeed();
}

const seed = readSeed();
document.getElementById('tb-floor').textContent = '1階';
document.getElementById('tb-turn').textContent = 'ターン 1';
document.getElementById('tb-best').textContent = 'ベスト 1階';
document.getElementById('tb-seed').textContent = `seed ${seed}`;
