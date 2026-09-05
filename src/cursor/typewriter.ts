export interface TypewriterOptions {
  charMs?: number;
  commaPauseMs?: number;
  fullStopPauseMs?: number;
}

const DEFAULTS: Required<TypewriterOptions> = {
  charMs: 28,
  commaPauseMs: 120,
  fullStopPauseMs: 260,
};

/** Reveals one string character by character on a variable per-character clock. */
export class Typewriter {
  private text = '';
  private visibleChars = 0;
  private nextCharAt = 0;
  private done = true;
  private onDone: (() => void) | null = null;
  private opts: Required<TypewriterOptions>;

  constructor(opts: TypewriterOptions = {}) {
    this.opts = { ...DEFAULTS, ...opts };
  }

  get isTyping(): boolean {
    return !this.done;
  }

  get visibleText(): string {
    return this.text.slice(0, this.visibleChars);
  }

  start(text: string, now: number, onDone?: () => void): void {
    this.text = text;
    this.visibleChars = 0;
    this.done = text.length === 0;
    this.nextCharAt = now;
    this.onDone = onDone ?? null;
    if (this.done) this.onDone?.();
  }

  clear(): void {
    this.text = '';
    this.visibleChars = 0;
    this.done = true;
    this.onDone = null;
  }

  tick(now: number): void {
    if (this.done) return;
    while (this.visibleChars < this.text.length && now >= this.nextCharAt) {
      const ch = this.text[this.visibleChars];
      this.visibleChars++;
      let delay = this.opts.charMs;
      if (ch === ',') delay += this.opts.commaPauseMs;
      else if (ch === '.' || ch === '!' || ch === '?') delay += this.opts.fullStopPauseMs;
      this.nextCharAt = Math.max(this.nextCharAt + delay, now + delay);
    }
    if (this.visibleChars >= this.text.length) {
      this.done = true;
      const cb = this.onDone;
      this.onDone = null;
      cb?.();
    }
  }
}
