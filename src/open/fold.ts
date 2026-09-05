export interface ScreenRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rot: number;
}

const OPEN_MS = 1100;
const SETTLE_MS = 200;
const SLIDE_MS = 500;
const GROW_MS = 650;
const SLIDE_START = 450;
const SETTLE_START = OPEN_MS - SETTLE_MS;

/**
 * Two sheets sliding through static angled masks inside a rotating stage.
 * Strictly 2D: no perspective, no rotate3d, no box-shadow, no blur.
 */
export class Fold {
  private stage: HTMLElement;
  private sheetBack: HTMLElement;
  private sheetFront: HTMLElement;
  private counter: HTMLElement;

  constructor(root: HTMLElement) {
    this.stage = document.createElement('div');
    this.stage.className = 'stage';

    const maskBack = document.createElement('div');
    maskBack.className = 'mask mask-back';
    this.sheetBack = document.createElement('div');
    this.sheetBack.className = 'sheet sheet-back';
    maskBack.appendChild(this.sheetBack);

    const maskFront = document.createElement('div');
    maskFront.className = 'mask mask-front';
    this.sheetFront = document.createElement('div');
    this.sheetFront.className = 'sheet sheet-front';
    maskFront.appendChild(this.sheetFront);

    this.counter = document.createElement('div');
    this.counter.className = 'stage-counter';
    this.counter.hidden = true;

    this.stage.append(maskBack, maskFront, this.counter);
    root.appendChild(this.stage);
    this.stage.style.opacity = '0';
    this.stage.style.pointerEvents = 'none';
  }

  get element(): HTMLElement {
    return this.stage;
  }

  private place(rect: ScreenRect, finalW: number, finalH: number): void {
    const scale = Math.min(rect.w / finalW, rect.h / finalH);
    this.stage.style.width = `${finalW}px`;
    this.stage.style.height = `${finalH}px`;
    this.stage.style.transform = `translate3d(${rect.cx - finalW / 2}px, ${rect.cy - finalH / 2}px, 0) rotate(${rect.rot}deg) scale(${scale})`;
  }

  private setImage(src: string, alt: string): void {
    this.sheetFront.style.backgroundImage = `url(${src})`;
    this.sheetFront.setAttribute('role', 'img');
    this.sheetFront.setAttribute('aria-label', alt);
  }

  setCounter(text: string | null): void {
    if (text) {
      this.counter.textContent = text;
      this.counter.hidden = false;
    } else {
      this.counter.hidden = true;
    }
  }

  open(
    origin: ScreenRect,
    finalW: number,
    finalH: number,
    imageSrc: string,
    alt: string,
    reducedMotion: boolean,
    onDone: () => void,
  ): void {
    this.setImage(imageSrc, alt);
    this.stage.classList.add('interactive');
    this.stage.style.pointerEvents = 'auto';

    this.stage.style.transition = 'none';
    this.sheetBack.style.transition = 'none';
    this.sheetFront.style.transition = 'none';
    this.sheetBack.style.transform = 'translate3d(0,0,0)';
    this.sheetFront.style.transform = 'translate3d(0,0,0)';
    this.stage.style.opacity = reducedMotion ? '0' : '1';
    this.place(origin, finalW, finalH);
    void this.stage.offsetWidth;

    const target: ScreenRect = {
      cx: window.innerWidth / 2,
      cy: window.innerHeight / 2,
      w: finalW,
      h: finalH,
      rot: -14,
    };

    if (reducedMotion) {
      this.stage.style.transition = `transform 250ms ease, opacity 250ms ease`;
      requestAnimationFrame(() => {
        this.stage.style.opacity = '1';
        this.place({ ...target, rot: -4 }, finalW, finalH);
      });
      window.setTimeout(onDone, 250);
      return;
    }

    requestAnimationFrame(() => {
      this.stage.style.transition = `transform ${GROW_MS}ms cubic-bezier(0.65,0,0.35,1)`;
      this.place(target, finalW, finalH);

      window.setTimeout(() => {
        const slide = finalH / 2;
        this.sheetBack.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.65,0,0.35,1)`;
        this.sheetFront.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.65,0,0.35,1)`;
        this.sheetBack.style.transform = `translate3d(0, ${-slide}px, 0)`;
        this.sheetFront.style.transform = `translate3d(0, ${slide}px, 0)`;
      }, SLIDE_START);

      window.setTimeout(() => {
        this.stage.style.transition = `transform ${SETTLE_MS}ms ease`;
        this.place({ ...target, rot: -4 }, finalW, finalH);
      }, SETTLE_START);

      window.setTimeout(onDone, OPEN_MS);
    });
  }

  step(imageSrc: string, alt: string, reducedMotion: boolean, onDone: () => void): void {
    const duration = reducedMotion ? 200 : 500;
    const w = this.stage.getBoundingClientRect().width || 400;

    this.sheetFront.style.transition = `transform ${duration}ms ease`;
    this.sheetFront.style.transform = `translate3d(${-w}px, 0, 0)`;

    window.setTimeout(() => {
      this.setImage(imageSrc, alt);
      this.sheetFront.style.transition = 'none';
      this.sheetFront.style.transform = `translate3d(${w}px, 0, 0)`;
      void this.sheetFront.offsetWidth;
      this.sheetFront.style.transition = `transform ${duration}ms ease`;
      this.sheetFront.style.transform = 'translate3d(0,0,0)';
      window.setTimeout(onDone, duration);
    }, duration);
  }

  close(origin: ScreenRect, finalW: number, finalH: number, reducedMotion: boolean, onDone: () => void): void {
    this.stage.classList.remove('interactive');
    this.stage.style.pointerEvents = 'none';
    const duration = reducedMotion ? 250 : 800;

    if (reducedMotion) {
      this.stage.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`;
      this.stage.style.opacity = '0';
      this.place(origin, finalW, finalH);
      window.setTimeout(onDone, duration);
      return;
    }

    const slideBack = duration * 0.4;
    const grow = duration * 0.6;

    this.sheetBack.style.transition = `transform ${slideBack}ms ease`;
    this.sheetFront.style.transition = `transform ${slideBack}ms ease`;
    this.sheetBack.style.transform = 'translate3d(0,0,0)';
    this.sheetFront.style.transform = 'translate3d(0,0,0)';

    window.setTimeout(() => {
      this.stage.style.transition = `transform ${grow}ms cubic-bezier(0.65,0,0.35,1)`;
      this.place(origin, finalW, finalH);
    }, slideBack);

    window.setTimeout(() => {
      this.stage.style.opacity = '0';
      onDone();
    }, duration);
  }
}
