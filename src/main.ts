import worksJson from '../data/works.json';
import introJson from '../data/intro.json';
import { appState, type ArrangementKind } from './state';
import { Spectrum } from './colour/spectrum';
import { Cursor } from './cursor/cursor';
import { Field, type Work } from './canvas/field';
import { Camera } from './canvas/camera';
import { IdleWatch } from './canvas/drift';
import { Fold, type ScreenRect } from './open/fold';
import { Lightbox } from './open/lightbox';

const works: Work[] = (worksJson as { works: Work[] }).works;
const introLines: string[] = introJson as string[];

const canvasEl = document.getElementById('canvas') as HTMLElement;
const fieldEl = document.getElementById('field') as HTMLElement;
const cursorRootEl = document.getElementById('cursor') as HTMLElement;
const caretEl = document.getElementById('caret') as HTMLElement;
const cursorTextEl = document.getElementById('cursor-text') as HTMLElement;
const liveRegionEl = document.getElementById('live-region') as HTMLElement;
const arrangementNavEl = document.getElementById('arrangement-nav') as HTMLElement;
const lightboxRootEl = document.getElementById('lightbox-root') as HTMLElement;
const appRootEl = document.getElementById('app') as HTMLElement;

const scrimEl = document.createElement('div');
scrimEl.className = 'scrim';
appRootEl.appendChild(scrimEl);

const introEchoesEl = document.createElement('div');
introEchoesEl.id = 'intro-echoes';
introEchoesEl.setAttribute('aria-hidden', 'true');
appRootEl.appendChild(introEchoesEl);

const hintEl = document.createElement('div');
hintEl.id = 'hint';
hintEl.setAttribute('aria-hidden', 'true');
hintEl.hidden = true;
appRootEl.appendChild(hintEl);

const MOBILE_QUERY = window.matchMedia('(max-width: 799px)');
const REDUCED_MOTION_QUERY = window.matchMedia('(prefers-reduced-motion: reduce)');

let mobile = MOBILE_QUERY.matches;
let reducedMotion = REDUCED_MOTION_QUERY.matches;

const cursor = new Cursor(cursorRootEl, caretEl, cursorTextEl, liveRegionEl);
const spectrum = new Spectrum(document.documentElement);
const camera = new Camera();
const idleWatch = new IdleWatch(performance.now());
const fold = new Fold(lightboxRootEl);
const lightbox = new Lightbox(fold, reducedMotion);

const field = new Field(fieldEl, works, cursor, (id) => openWork(id), reducedMotion);
field.setMobileMode(mobile);

{
  const initialKind: ArrangementKind = 'grid';
  const centroid = field.snapToArrangement(initialKind);
  const bbox = field.centroidFor(initialKind);
  camera.setBounds(bbox);
  camera.jumpTo(centroid.cx, centroid.cy);
}

if (mobile) {
  cursor.setStatic(true);
  cursor.setPointer(window.innerWidth / 2, window.innerHeight / 2);
}

// ---------------------------------------------------------------- intro ---
//
// Each line appears frozen wherever the pointer was when it started, and
// stays put -- no chasing -- until the visitor clicks (or presses
// Enter/Space). That click stamps the line as a permanent black echo at its
// frozen spot, then the next line appears wherever the pointer is now. By
// the last line the screen has accumulated a scatter of these echoes.

let introIndex = 0;

function updateHint(): void {
  const s = appState.get();
  if (s.kind === 'INTRO') {
    hintEl.textContent = introIndex >= introLines.length - 1 ? 'click for a selected work' : 'click to continue';
    hintEl.hidden = false;
  } else if (s.kind === 'FIELD') {
    hintEl.textContent = 'click for a selected work';
    hintEl.hidden = false;
  } else {
    hintEl.hidden = true;
  }
}

function startIntroLine(x: number, y: number): void {
  if (appState.get().kind !== 'INTRO') return;
  if (introIndex >= introLines.length) {
    finishIntro();
    return;
  }
  cursor.freezeAt(x, y);
  cursor.typeLine(introLines[introIndex], performance.now());
  updateHint();
}

function advanceIntro(x: number, y: number): void {
  if (appState.get().kind !== 'INTRO') return;
  const text = cursor.displayedText;
  if (text) {
    const echo = document.createElement('div');
    echo.className = 'echo';
    echo.style.left = `${cursor.x}px`;
    echo.style.top = `${cursor.y}px`;
    echo.textContent = text;
    introEchoesEl.appendChild(echo);
  }
  cursor.clearLine();
  introIndex++;
  startIntroLine(x, y);
}

function finishIntro(): void {
  if (appState.get().kind !== 'INTRO') return;
  cursor.clearLine();
  cursor.unfreeze();
  const kind: ArrangementKind = 'grid';
  appState.set({ kind: 'FIELD', arrangement: kind, hoverId: null });
  spectrum.set(kind, performance.now());
  canvasEl.style.transition = 'opacity 600ms ease';
  canvasEl.style.visibility = 'visible';
  requestAnimationFrame(() => {
    canvasEl.style.opacity = '1';
  });
  fieldEl.removeAttribute('aria-hidden');
  if (!mobile) arrangementNavEl.hidden = false;
  updateArrangementButtons(kind);
  updateHint();

  introEchoesEl.style.transition = 'opacity 600ms ease';
  introEchoesEl.style.opacity = '0';
  window.setTimeout(() => introEchoesEl.remove(), 650);
}

window.addEventListener(
  'pointerdown',
  (e) => {
    if (appState.get().kind === 'INTRO') advanceIntro(e.clientX, e.clientY);
  },
  { capture: true },
);
window.addEventListener(
  'keydown',
  (e) => {
    if (appState.get().kind === 'INTRO' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      advanceIntro(cursor.pointerX, cursor.pointerY);
    }
  },
  { capture: true },
);

startIntroLine(cursor.pointerX, cursor.pointerY);

// ------------------------------------------------------------ pointer ---

window.addEventListener('pointermove', (e) => {
  idleWatch.notifyInput(performance.now());
  if (mobile) return;
  cursor.setPointer(e.clientX, e.clientY);
  const target = e.target as HTMLElement;
  const overControl = target.closest('.arrangement-nav, .stage.interactive');
  cursorRootEl.style.opacity = overControl ? '0' : '1';
});

let dragStart: { x: number; y: number } | null = null;
let dragMoved = false;
let activePointerId: number | null = null;
const DRAG_THRESHOLD = 6;

// Pointer capture is deferred until a drag is confirmed: capturing eagerly on
// every pointerdown reroutes the subsequent click away from the rect that was
// actually pressed, which would silently break click-to-open.
canvasEl.addEventListener('pointerdown', (e) => {
  if (appState.get().kind !== 'FIELD') return;
  dragStart = { x: e.clientX, y: e.clientY };
  dragMoved = false;
  activePointerId = e.pointerId;
  camera.onPointerDown(e.clientX, e.clientY);
});

window.addEventListener('pointermove', (e) => {
  if (!dragStart || e.pointerId !== activePointerId) return;
  const dx = e.clientX - dragStart.x;
  const dy = e.clientY - dragStart.y;
  if (!dragMoved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
    dragMoved = true;
    field.setClickSuppressed(true);
    canvasEl.setPointerCapture(activePointerId);
  }
  camera.onPointerMove(e.clientX, e.clientY);
});

window.addEventListener('pointerup', (e) => {
  if (activePointerId !== null && e.pointerId === activePointerId && canvasEl.hasPointerCapture(activePointerId)) {
    canvasEl.releasePointerCapture(activePointerId);
  }
  camera.onPointerUp();
  dragStart = null;
  activePointerId = null;
  window.setTimeout(() => field.setClickSuppressed(false), 0);
});

canvasEl.addEventListener(
  'wheel',
  (e) => {
    if (appState.get().kind !== 'FIELD') return;
    e.preventDefault();
    camera.onWheel(e.deltaX, e.deltaY);
    idleWatch.notifyInput(performance.now());
  },
  { passive: false },
);

// ------------------------------------------------------------ keyboard ---

window.addEventListener('keydown', (e) => {
  idleWatch.notifyInput(performance.now());
  const s = appState.get();

  if (s.kind === 'OPEN') {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeWork();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      lightbox.stepNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      lightbox.stepPrev();
    }
    return;
  }

  if (s.kind !== 'FIELD' || mobile) return;

  if (e.key === '1') switchArrangement('cloud');
  else if (e.key === '2') switchArrangement('grid');
  else if (e.key === '3') switchArrangement('stack');
  else if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    const step = 60;
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    camera.jumpTo(camera.x + dx, camera.y + dy);
  }
});

// -------------------------------------------------------- arrangements ---

function updateArrangementButtons(kind: ArrangementKind): void {
  arrangementNavEl.querySelectorAll<HTMLButtonElement>('.arrangement-btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.arrangement === kind));
  });
}

arrangementNavEl.querySelectorAll<HTMLButtonElement>('.arrangement-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const kind = btn.dataset.arrangement as ArrangementKind;
    switchArrangement(kind);
  });
});

function switchArrangement(kind: ArrangementKind): void {
  const s = appState.get();
  if (s.kind !== 'FIELD' || s.arrangement === kind) return;
  const now = performance.now();
  const centroid = field.setArrangement(kind, now, { x: camera.x, y: camera.y });
  const bbox = field.centroidFor(kind);
  camera.setBounds(bbox);
  camera.recentreTo(centroid.cx, centroid.cy, now, 900);
  spectrum.set(kind, now);
  appState.set({ kind: 'FIELD', arrangement: kind, hoverId: null });
  updateArrangementButtons(kind);
}

// ----------------------------------------------------------- open/close ---

function screenRectFor(id: string, now: number): ScreenRect | null {
  const rect = field.getLiveWorldRect(id, now);
  if (!rect) return null;
  return {
    cx: window.innerWidth / 2 + (rect.x - camera.x),
    cy: window.innerHeight / 2 + (rect.y - camera.y),
    w: rect.w,
    h: rect.h,
    rot: rect.rot,
  };
}

function finalSizeFor(work: Work): { w: number; h: number } {
  const boxSize = mobile ? 0.9 * window.innerWidth : 0.85 * Math.min(window.innerWidth, window.innerHeight);
  const ratio = work.ratio.w / work.ratio.h;
  return ratio >= 1 ? { w: boxSize, h: boxSize / ratio } : { w: boxSize * ratio, h: boxSize };
}

function openWork(id: string): void {
  const s = appState.get();
  if (s.kind !== 'FIELD') return;
  const work = field.getWork(id);
  if (!work) return;
  const now = performance.now();
  const origin = screenRectFor(id, now);
  if (!origin) return;
  const { w: finalW, h: finalH } = finalSizeFor(work);

  appState.set({ kind: 'OPENING', workId: id });
  cursor.clearLine();
  field.hide(id);
  field.setDriftActive(false, now);
  updateHint();

  lightbox.openWork(work, origin, finalW, finalH, () => {
    appState.set({ kind: 'OPEN', workId: id, mediaIndex: 0 });
    scrimEl.style.pointerEvents = 'auto';
    spectrum.set('open', performance.now());
  });
}

function closeWork(): void {
  const s = appState.get();
  if (s.kind !== 'OPEN') return;
  const id = s.workId;
  const now = performance.now();
  const toArrangement = field.currentArrangement;
  const work = field.getWork(id);
  if (!work) return;
  const origin = screenRectFor(id, now) ?? {
    cx: window.innerWidth / 2,
    cy: window.innerHeight / 2,
    w: 100,
    h: 100,
    rot: 0,
  };
  const { w: finalW, h: finalH } = finalSizeFor(work);

  appState.set({ kind: 'CLOSING', workId: id, toArrangement });
  scrimEl.style.pointerEvents = 'none';

  lightbox.close(origin, finalW, finalH, () => {
    field.show(id);
    field.focusItem(id);
    appState.set({ kind: 'FIELD', arrangement: toArrangement, hoverId: null });
    spectrum.set(toArrangement, performance.now());
    updateHint();
  });
}

fold.element.addEventListener('click', (e) => {
  if (!lightbox.isOpen) return;
  if (lightbox.isSingleItem) {
    closeWork();
    return;
  }
  const rect = fold.element.getBoundingClientRect();
  lightbox.handleStageClick((e as MouseEvent).clientX, rect.left, rect.width);
});

scrimEl.addEventListener('click', () => {
  if (appState.get().kind === 'OPEN') closeWork();
});

// ------------------------------------------------------------- resize ---

function handleResize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const wasMobile = mobile;
  mobile = MOBILE_QUERY.matches;

  const s = appState.get();

  if (mobile !== wasMobile) {
    field.setMobileMode(mobile);
    cursor.setStatic(mobile);
    arrangementNavEl.hidden = mobile || s.kind === 'INTRO';
    // Entering mobile mandates grid-only; leaving it can stay wherever it was,
    // since grid is a valid desktop arrangement too.
    if (mobile && s.kind === 'FIELD' && s.arrangement !== 'grid') {
      const centroid = field.snapToArrangement('grid');
      camera.jumpTo(centroid.cx, centroid.cy);
      appState.set({ kind: 'FIELD', arrangement: 'grid', hoverId: null });
      spectrum.set('grid', performance.now());
      updateArrangementButtons('grid');
    }
  }

  field.setViewport(w, h);
  const finalState = appState.get();
  const kind: ArrangementKind = finalState.kind === 'FIELD' ? finalState.arrangement : field.currentArrangement;
  const bbox = field.centroidFor(kind);
  camera.setBounds(bbox);
}
window.addEventListener('resize', handleResize);

REDUCED_MOTION_QUERY.addEventListener('change', (e) => {
  reducedMotion = e.matches;
  field.setReducedMotion(reducedMotion);
  lightbox.setReducedMotion(reducedMotion);
});

// --------------------------------------------------------------- loop ---

function frame(now: number): void {
  requestAnimationFrame(frame);

  cursor.tick(now);
  spectrum.tick(now);

  const s = appState.get();
  let camPos = { x: camera.x, y: camera.y };

  if (s.kind === 'FIELD') {
    field.setDriftActive(!mobile && !reducedMotion && idleWatch.isIdle(now), now);
    camPos = camera.tick(now);
  } else {
    field.setDriftActive(false, now);
  }

  field.tick(now, camPos);
}
requestAnimationFrame(frame);
