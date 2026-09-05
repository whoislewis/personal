export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Numeric cubic-bezier(x1,y1,x2,y2) evaluator matching CSS easing curves,
 * for use where the tween is driven by our own rAF loop rather than CSS.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  function solveTForX(x: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleDX(t);
      if (Math.abs(dx) < 1e-6) break;
      t -= (sampleX(t) - x) / dx;
    }
    if (t >= 0 && t <= 1) return t;
    let lo = 0;
    let hi = 1;
    let guess = x;
    for (let i = 0; i < 20; i++) {
      const cur = sampleX(guess);
      if (Math.abs(cur - x) < 1e-6) break;
      if (cur < x) lo = guess;
      else hi = guess;
      guess = (lo + hi) / 2;
    }
    return guess;
  }

  return (x: number) => sampleY(solveTForX(clamp(x, 0, 1)));
}

export const easeTravel = cubicBezier(0.16, 1, 0.3, 1);

/** mulberry32 seeded PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** String -> 32bit seed, so item ids can seed their own PRNG stream deterministically. */
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
