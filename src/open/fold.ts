export interface ScreenRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rot: number;
}

const OPEN_MS = 800;
const CLOSE_MS = 700;
const STEP_MS = 450;
const SETTLE_ROT = -4;

/**
 * A card flip: the stage flies from the origin rectangle to centre while the
 * card itself turns edge-on (scaleX -> 0) and back out (-> 1), swapping from
 * its black back face to the image front face exactly at the zero-width
 * instant. Strictly 2D: no perspective, no rotate3d, no box-shadow, no blur.
 */
export class Fold {
  private stage: HTMLElement;
  private card: HTMLElement;
  private faceBack: HTMLElement;
  private faceFront: HTMLElement;
  private counter: HTMLElement;

  constructor(root: HTMLElement) {
    this.stage = document.createElement('div');
    this.stage.className = 'stage';

    this.card = document.createElement('div');
    this.card.className = 'card';

    this.faceBack = document.createElement('div');
    this.faceBack.className = 'face face-back';

    this.faceFront = document.createElement('div');
    this.faceFront.className = 'face face-front';

    this.card.append(this.faceBack, this.faceFront);

    this.counter = document.createElement('div');
    this.counter.className = 'stage-counter';
    this.counter.hidden = true;

    this.stage.append(this.card, this.counter);
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

  private setFrontImage(src: string, alt: string): void {
    this.faceFront.style.backgroundImage = `url(${src})`;
    this.faceFront.setAttribute('role', 'img');
    this.faceFront.setAttribute('aria-label', alt);
  }

  private showFace(face: 'back' | 'front'): void {
    this.faceBack.style.opacity = face === 'back' ? '1' : '0';
    this.faceFront.style.opacity = face === 'front' ? '1' : '0';
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
    this.setFrontImage(imageSrc, alt);
    this.stage.classList.add('interactive');
    this.stage.style.pointerEvents = 'auto';

    this.stage.style.transition = 'none';
    this.card.style.transition = 'none';
    this.card.style.transform = 'scaleX(1)';
    this.showFace('back');
    this.stage.style.opacity = '1';
    this.place(origin, finalW, finalH);
    void this.stage.offsetWidth;

    const target: ScreenRect = {
      cx: window.innerWidth / 2,
      cy: window.innerHeight / 2,
      w: finalW,
      h: finalH,
      rot: SETTLE_ROT,
    };

    if (reducedMotion) {
      this.showFace('front');
      this.stage.style.transition = 'transform 250ms ease';
      requestAnimationFrame(() => this.place(target, finalW, finalH));
      window.setTimeout(onDone, 250);
      return;
    }

    requestAnimationFrame(() => {
      this.stage.style.transition = `transform ${OPEN_MS}ms cubic-bezier(0.65,0,0.35,1)`;
      this.place(target, finalW, finalH);

      this.card.style.transition = `transform ${OPEN_MS / 2}ms ease-in`;
      this.card.style.transform = 'scaleX(0)';

      window.setTimeout(() => {
        this.showFace('front');
        this.card.style.transition = `transform ${OPEN_MS / 2}ms ease-out`;
        this.card.style.transform = 'scaleX(1)';
      }, OPEN_MS / 2);

      window.setTimeout(onDone, OPEN_MS);
    });
  }

  step(imageSrc: string, alt: string, reducedMotion: boolean, onDone: () => void): void {
    const duration = reducedMotion ? 200 : STEP_MS;

    this.card.style.transition = `transform ${duration / 2}ms ease-in`;
    this.card.style.transform = 'scaleX(0)';

    window.setTimeout(() => {
      this.setFrontImage(imageSrc, alt);
      this.card.style.transition = `transform ${duration / 2}ms ease-out`;
      this.card.style.transform = 'scaleX(1)';
      window.setTimeout(onDone, duration / 2);
    }, duration / 2);
  }

  close(origin: ScreenRect, finalW: number, finalH: number, reducedMotion: boolean, onDone: () => void): void {
    this.stage.classList.remove('interactive');
    this.stage.style.pointerEvents = 'none';
    const duration = reducedMotion ? 250 : CLOSE_MS;

    if (reducedMotion) {
      this.showFace('back');
      this.stage.style.transition = `transform ${duration}ms ease, opacity ${duration}ms ease`;
      this.stage.style.opacity = '0';
      this.place(origin, finalW, finalH);
      window.setTimeout(onDone, duration);
      return;
    }

    this.card.style.transition = `transform ${duration / 2}ms ease-in`;
    this.card.style.transform = 'scaleX(0)';

    this.stage.style.transition = `transform ${duration}ms cubic-bezier(0.65,0,0.35,1)`;
    this.place(origin, finalW, finalH);

    window.setTimeout(() => {
      this.showFace('back');
      this.card.style.transition = `transform ${duration / 2}ms ease-out`;
      this.card.style.transform = 'scaleX(1)';
    }, duration / 2);

    window.setTimeout(() => {
      this.stage.style.opacity = '0';
      onDone();
    }, duration);
  }
}
