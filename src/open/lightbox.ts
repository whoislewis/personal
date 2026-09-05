import { Fold, type ScreenRect } from './fold';
import type { Work } from '../canvas/field';

export class Lightbox {
  private work: Work | null = null;
  private mediaIndex = 0;

  constructor(private fold: Fold, private reducedMotion: boolean) {}

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
  }

  get isOpen(): boolean {
    return this.work !== null;
  }

  get currentWork(): Work | null {
    return this.work;
  }

  get isSingleItem(): boolean {
    return !this.work || this.work.media.length <= 1;
  }

  openWork(work: Work, origin: ScreenRect, finalW: number, finalH: number, onDone: () => void): void {
    this.work = work;
    this.mediaIndex = 0;
    const media = work.media[0];
    this.fold.open(origin, finalW, finalH, media.src, media.alt, this.reducedMotion, () => {
      this.updateCounter();
      onDone();
    });
  }

  private updateCounter(): void {
    if (!this.work) return;
    if (this.work.media.length > 1) {
      this.fold.setCounter(`${this.mediaIndex + 1} / ${this.work.media.length}`);
    } else {
      this.fold.setCounter(null);
    }
  }

  stepNext(): void {
    this.step(1);
  }

  stepPrev(): void {
    this.step(-1);
  }

  private step(dir: 1 | -1): void {
    if (!this.work || this.work.media.length <= 1) return;
    const n = this.work.media.length;
    this.mediaIndex = (this.mediaIndex + dir + n) % n;
    const media = this.work.media[this.mediaIndex];
    this.fold.step(media.src, media.alt, this.reducedMotion, () => this.updateCounter());
  }

  handleStageClick(clientX: number, rectLeft: number, rectWidth: number): void {
    const isRight = clientX - rectLeft > rectWidth / 2;
    if (isRight) this.stepNext();
    else this.stepPrev();
  }

  close(origin: ScreenRect, finalW: number, finalH: number, onDone: () => void): void {
    this.fold.close(origin, finalW, finalH, this.reducedMotion, () => {
      this.work = null;
      onDone();
    });
  }
}
