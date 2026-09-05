import { clamp, hashSeed, mulberry32 } from '../easing';

export interface DriftOffset {
  dx: number;
  dy: number;
}

interface DriftItem {
  phaseX: number;
  phaseY: number;
  freqX: number;
  freqY: number;
}

const AMPLITUDE = 14;
const OFFSET_CLAMP = 30;
const BASE_PERIOD_S = 12;

/** Per-item low-frequency drift, active only while idle. Never degrades the arrangement. */
export class Drift {
  private items = new Map<string, DriftItem>();
  private active = false;
  private stopStart: number | null = null;

  private ensure(id: string): DriftItem {
    let item = this.items.get(id);
    if (!item) {
      const rng = mulberry32(hashSeed(id));
      item = {
        phaseX: rng() * Math.PI * 2,
        phaseY: rng() * Math.PI * 2,
        freqX: 0.85 + rng() * 0.3,
        freqY: 0.85 + rng() * 0.3,
      };
      this.items.set(id, item);
    }
    return item;
  }

  setActive(active: boolean, now: number): void {
    if (active === this.active) return;
    this.active = active;
    this.stopStart = active ? null : now;
  }

  get isActive(): boolean {
    return this.active;
  }

  offsetFor(id: string, now: number): DriftOffset {
    let multiplier = this.active ? 1 : 0;
    if (this.stopStart !== null) {
      const p = clamp((now - this.stopStart) / 500, 0, 1);
      multiplier = 1 - p;
    }
    if (multiplier <= 0) return { dx: 0, dy: 0 };

    const item = this.ensure(id);
    const t = now / 1000;
    const w = (2 * Math.PI) / BASE_PERIOD_S;
    const dx = Math.sin(t * w * item.freqX + item.phaseX) * AMPLITUDE;
    const dy = Math.cos(t * w * item.freqY + item.phaseY) * AMPLITUDE;
    return {
      dx: clamp(dx * multiplier, -OFFSET_CLAMP, OFFSET_CLAMP),
      dy: clamp(dy * multiplier, -OFFSET_CLAMP, OFFSET_CLAMP),
    };
  }
}

/** Resets on any pointer move, drag, wheel or key press; fires after a full new idle window. */
export class IdleWatch {
  private lastInputAt: number;
  private readonly idleMs = 5000;

  constructor(now: number) {
    this.lastInputAt = now;
  }

  notifyInput(now: number): void {
    this.lastInputAt = now;
  }

  isIdle(now: number): boolean {
    return now - this.lastInputAt >= this.idleMs;
  }
}
