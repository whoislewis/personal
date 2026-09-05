import { Typewriter } from './typewriter';
import { clamp } from '../easing';

const BLINK_MS = 530;
const LERP_RATE = 0.12;

/**
 * The one cursor: a pointer-following caret that is also the sole vehicle
 * for typed text (intro sentences, hover lines). One line at a time.
 */
export class Cursor {
  pointerX: number;
  pointerY: number;
  x: number;
  y: number;

  private typewriter = new Typewriter();
  private blinkAnchor = 0;
  private fadeStart: number | null = null;
  private fadeMs = 300;
  private static_ = false;

  constructor(
    private rootEl: HTMLElement,
    private caretEl: HTMLElement,
    private textEl: HTMLElement,
    private liveRegionEl: HTMLElement,
  ) {
    this.pointerX = window.innerWidth / 2;
    this.pointerY = window.innerHeight / 2;
    this.x = this.pointerX;
    this.y = this.pointerY;
  }

  setPointer(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
  }

  /** Mobile: place the caret immediately with no chase. */
  snapTo(x: number, y: number): void {
    this.pointerX = x;
    this.pointerY = y;
    this.x = x;
    this.y = y;
  }

  setStatic(isStatic: boolean): void {
    this.static_ = isStatic;
  }

  typeLine(text: string, now: number, onDone?: () => void): void {
    this.fadeStart = null;
    this.textEl.style.opacity = '1';
    this.typewriter.start(text, now, onDone);
    this.liveRegionEl.textContent = text;
  }

  startFade(now: number): void {
    this.fadeStart = now;
  }

  clearLine(): void {
    this.typewriter.clear();
    this.textEl.textContent = '';
    this.fadeStart = null;
    this.textEl.style.opacity = '1';
    this.liveRegionEl.textContent = '';
  }

  get isTyping(): boolean {
    return this.typewriter.isTyping;
  }

  tick(now: number): void {
    if (!this.static_) {
      this.x += (this.pointerX - this.x) * LERP_RATE;
      this.y += (this.pointerY - this.y) * LERP_RATE;
    } else {
      this.x = this.pointerX;
      this.y = this.pointerY;
    }
    this.rootEl.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;

    this.typewriter.tick(now);
    this.textEl.textContent = this.typewriter.visibleText;

    if (this.typewriter.isTyping) {
      this.caretEl.classList.remove('hidden');
      this.blinkAnchor = now;
    } else {
      const phase = (now - this.blinkAnchor) % (BLINK_MS * 2);
      this.caretEl.classList.toggle('hidden', phase >= BLINK_MS);
    }

    if (this.fadeStart !== null) {
      const p = clamp((now - this.fadeStart) / this.fadeMs, 0, 1);
      this.textEl.style.opacity = String(1 - p);
    }
  }
}
