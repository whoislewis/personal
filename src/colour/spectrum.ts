import { interpolate, formatHex } from 'culori';
import { easeInOutCubic, lerp } from '../easing';

const BLUE = '#144AD1';
const RED = '#F95331';

const lch = interpolate([BLUE, RED], 'lch');

export function colourAt(t: number): string {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return formatHex(lch(clamped)) ?? BLUE;
}

export type ColourKey = 'intro' | 'cloud' | 'grid' | 'stack' | 'open';

export const PROGRESS_BY_KEY: Record<ColourKey, number> = {
  intro: 0.0,
  cloud: 0.15,
  grid: 0.45,
  stack: 0.75,
  open: 1.0,
};

const TRANSITION_MS = 900;

/** Eases the background colour between state stops in LCH, in step with arrangement travel. */
export class Spectrum {
  private fromT = PROGRESS_BY_KEY.intro;
  private toT = PROGRESS_BY_KEY.intro;
  private start = 0;
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    this.apply(this.toT);
  }

  set(key: ColourKey, now: number) {
    const target = PROGRESS_BY_KEY[key];
    if (target === this.toT) return;
    this.fromT = this.currentT(now);
    this.toT = target;
    this.start = now;
  }

  private currentT(now: number): number {
    const dt = now - this.start;
    if (dt >= TRANSITION_MS) return this.toT;
    const p = easeInOutCubic(dt / TRANSITION_MS);
    return lerp(this.fromT, this.toT, p);
  }

  private apply(t: number) {
    this.el.style.setProperty('--bg', colourAt(t));
  }

  tick(now: number) {
    this.apply(this.currentT(now));
  }
}
