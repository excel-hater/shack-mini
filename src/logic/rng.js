// シード付き乱数（mulberry32）。同じシードなら同じ乱数列になる。

export function createRng(seed) {
  let s = seed >>> 0;
  const rng = {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    // min以上max以下の整数
    int(min, max) {
      return min + Math.floor(rng.next() * (max - min + 1));
    },
    chance(p) {
      return rng.next() < p;
    },
    pick(arr) {
      return arr[Math.floor(rng.next() * arr.length)];
    },
    // 元の配列を並べ替えずに、シャッフルした新しい配列を返す
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };
  return rng;
}

export function randomSeed() {
  return Math.floor(Math.random() * 2147483647) + 1;
}
