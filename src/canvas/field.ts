import {
  boundingBox,
  solveCloud,
  solveGrid,
  solveStack,
  sizeForRatio,
  type ItemLayout,
} from './arrangements';
import {
  buildTravelPlans,
  layoutAtTime,
  isTravelDone,
  type TravelPlan,
} from './transitions';
import { Drift } from './drift';
import { clamp, easeOutCubic, hashSeed, mulberry32 } from '../easing';
import type { ArrangementKind } from '../state';
import type { Cursor } from '../cursor/cursor';

export interface WorkMedia {
  src: string;
  w: number;
  h: number;
  alt: string;
}

export interface Work {
  id: string;
  title: string;
  line: string;
  year: number;
  ratio: { w: number; h: number };
  media: WorkMedia[];
}

interface ItemRuntime {
  work: Work;
  el: HTMLElement;
  baseW: number;
  baseH: number;
  anchor: ItemLayout;
  travel: { plan: TravelPlan; startTime: number } | null;
  hoverScaleFrom: number;
  hoverScaleTo: number;
  hoverScaleStart: number;
  hovered: boolean;
}

const HOVER_SCALE = 1.04;
const HOVER_TWEEN_MS = 200;
const DWELL_MS = 120;
const CULL_MARGIN_VIEWPORTS = 1;

export class Field {
  private items = new Map<string, ItemRuntime>();
  private order: string[] = [];
  private layouts: Record<ArrangementKind, Map<string, ItemLayout> | null> = {
    cloud: null,
    grid: null,
    stack: null,
  };
  private arrangement: ArrangementKind = 'cloud';
  private viewportW = window.innerWidth;
  private viewportH = window.innerHeight;
  private drift = new Drift();
  private reducedMotion: boolean;
  private dwellTimer: number | null = null;
  private dwellId: string | null = null;
  private suppressClick = false;
  private mobileMode = false;
  private lastTapId: string | null = null;
  private lastTapAt = 0;

  constructor(
    private container: HTMLElement,
    works: Work[],
    private cursor: Cursor,
    private onOpen: (id: string) => void,
    reducedMotion: boolean,
  ) {
    this.reducedMotion = reducedMotion;
    this.order = works.map((w) => w.id);

    for (const work of works) {
      const { w: baseW, h: baseH } = sizeForRatio(work.ratio.w, work.ratio.h);
      const el = this.buildElement(work, baseW, baseH);
      container.appendChild(el);
      this.items.set(work.id, {
        work,
        el,
        baseW,
        baseH,
        anchor: { x: 0, y: 0, w: baseW, h: baseH, rot: 0 },
        travel: null,
        hoverScaleFrom: 1,
        hoverScaleTo: 1,
        hoverScaleStart: 0,
        hovered: false,
      });
    }

    this.recomputeViewportLayouts();
    this.layouts.stack = solveStack(works);
    this.applyLayoutImmediate(this.layouts.cloud!);
  }

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
  }

  setClickSuppressed(v: boolean): void {
    this.suppressClick = v;
  }

  setMobileMode(v: boolean): void {
    this.mobileMode = v;
  }

  get currentArrangement(): ArrangementKind {
    return this.arrangement;
  }

  getOrder(): string[] {
    return [...this.order];
  }

  getWork(id: string): Work | undefined {
    return this.items.get(id)?.work;
  }

  centroidFor(kind: ArrangementKind): { cx: number; cy: number; w: number; h: number } {
    return boundingBox(this.layouts[kind]!);
  }

  private buildElement(work: Work, baseW: number, baseH: number): HTMLElement {
    const el = document.createElement('div');
    el.className = 'rect';
    el.dataset.id = work.id;
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', work.title);
    el.title = work.title;
    el.style.width = `${baseW}px`;
    el.style.height = `${baseH}px`;

    if (work.media.length > 1) {
      const rngA = mulberry32(hashSeed(work.id + ':s1'));
      const rngB = mulberry32(hashSeed(work.id + ':s2'));
      const layer1 = document.createElement('div');
      layer1.className = 'stack-layer';
      layer1.style.zIndex = '-1';
      layer1.style.transform = `translate(3px, 3px) rotate(${(rngA() - 0.5) * 2}deg)`;
      const layer2 = document.createElement('div');
      layer2.className = 'stack-layer';
      layer2.style.zIndex = '-2';
      layer2.style.transform = `translate(6px, 6px) rotate(${(rngB() - 0.5) * 2}deg)`;
      el.appendChild(layer1);
      el.appendChild(layer2);
    }

    el.addEventListener('pointerenter', () => {
      if (!this.mobileMode) this.handleHoverStart(work.id, false);
    });
    el.addEventListener('pointerleave', () => {
      if (!this.mobileMode) this.handleHoverEnd(work.id);
    });
    el.addEventListener('focus', () => this.handleHoverStart(work.id, true));
    el.addEventListener('blur', () => this.handleHoverEnd(work.id));
    el.addEventListener('click', (e) => {
      if (this.suppressClick) return;
      if (this.mobileMode) {
        this.handleMobileTap(work.id, e as MouseEvent);
        return;
      }
      this.onOpen(work.id);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.onOpen(work.id);
      }
    });

    return el;
  }

  private handleHoverStart(id: string, immediate: boolean): void {
    const item = this.items.get(id);
    if (!item) return;
    const now = performance.now();
    item.hovered = true;
    item.hoverScaleFrom = this.currentHoverScale(item, now);
    item.hoverScaleTo = HOVER_SCALE;
    item.hoverScaleStart = now;
    item.el.style.zIndex = '1000';

    if (this.dwellTimer !== null) window.clearTimeout(this.dwellTimer);
    const startTyping = () => {
      this.dwellId = id;
      this.cursor.typeLine(item.work.line, performance.now());
    };
    if (immediate) startTyping();
    else this.dwellTimer = window.setTimeout(startTyping, DWELL_MS);
  }

  private handleHoverEnd(id: string): void {
    const item = this.items.get(id);
    if (!item) return;
    const now = performance.now();
    item.hovered = false;
    item.hoverScaleFrom = this.currentHoverScale(item, now);
    item.hoverScaleTo = 1;
    item.hoverScaleStart = now;
    item.el.style.zIndex = String(item.anchor.z ?? 0);

    if (this.dwellTimer !== null) {
      window.clearTimeout(this.dwellTimer);
      this.dwellTimer = null;
    }
    if (this.dwellId === id) {
      this.cursor.clearLine();
      this.dwellId = null;
    }
  }

  private handleMobileTap(id: string, e: MouseEvent): void {
    const now = performance.now();
    const item = this.items.get(id);
    if (!item) return;

    if (this.lastTapId === id && now - this.lastTapAt < 3000) {
      this.lastTapId = null;
      this.onOpen(id);
      return;
    }

    this.lastTapId = id;
    this.lastTapAt = now;
    this.cursor.snapTo(e.clientX, e.clientY);
    this.cursor.typeLine(item.work.line, now);
    window.setTimeout(() => {
      if (this.lastTapId === id && performance.now() - this.lastTapAt >= 1900) {
        this.cursor.clearLine();
      }
    }, 2000);
  }

  private currentHoverScale(item: ItemRuntime, now: number): number {
    const p = clamp((now - item.hoverScaleStart) / HOVER_TWEEN_MS, 0, 1);
    return item.hoverScaleFrom + (item.hoverScaleTo - item.hoverScaleFrom) * easeOutCubic(p);
  }

  private recomputeViewportLayouts(): void {
    const works = this.order.map((id) => this.items.get(id)!.work);
    this.layouts.cloud = solveCloud(works, this.viewportW, this.viewportH);
    this.layouts.grid = solveGrid(works, this.viewportW);
  }

  private applyLayoutImmediate(layout: Map<string, ItemLayout>): void {
    for (const [id, item] of this.items) {
      const l = layout.get(id);
      if (l) item.anchor = l;
      item.travel = null;
    }
  }

  /** Snap directly to an arrangement with no travel, e.g. the initial layout before the field is shown. */
  snapToArrangement(kind: ArrangementKind): { cx: number; cy: number } {
    const layout = this.layouts[kind]!;
    this.applyLayoutImmediate(layout);
    this.arrangement = kind;
    const bbox = boundingBox(layout);
    return { cx: bbox.cx, cy: bbox.cy };
  }

  setViewport(w: number, h: number): void {
    this.viewportW = w;
    this.viewportH = h;
    this.recomputeViewportLayouts();
    if (this.arrangement === 'cloud' || this.arrangement === 'grid') {
      this.applyLayoutImmediate(this.layouts[this.arrangement]!);
    }
  }

  setArrangement(
    kind: ArrangementKind,
    now: number,
    camera: { x: number; y: number },
  ): { cx: number; cy: number } {
    const toLayout = this.layouts[kind]!;

    if (kind !== this.arrangement) {
      if (this.reducedMotion) {
        for (const item of this.items.values()) {
          const l = toLayout.get(item.work.id);
          if (l) item.anchor = l;
          item.travel = null;
          item.el.style.transition = 'opacity 200ms ease';
          item.el.style.opacity = '0';
          requestAnimationFrame(() => {
            item.el.style.opacity = '1';
          });
        }
      } else {
        const fromCurrent = new Map<string, ItemLayout>();
        for (const [id, item] of this.items) fromCurrent.set(id, this.liveLayout(item, now));
        const plans = buildTravelPlans(this.order, fromCurrent, toLayout, camera.x, camera.y);
        for (const [id, item] of this.items) {
          const plan = plans.get(id);
          if (plan) item.travel = { plan, startTime: now };
          const l = toLayout.get(id);
          if (l) item.anchor = l;
        }
      }
    }

    this.arrangement = kind;
    const bbox = boundingBox(toLayout);
    return { cx: bbox.cx, cy: bbox.cy };
  }

  private liveLayout(item: ItemRuntime, now: number): ItemLayout {
    if (item.travel) {
      if (isTravelDone(item.travel.plan, item.travel.startTime, now)) {
        item.travel = null;
        return item.anchor;
      }
      return layoutAtTime(item.travel.plan, item.travel.startTime, now);
    }
    return item.anchor;
  }

  getLiveWorldRect(
    id: string,
    now: number,
  ): { x: number; y: number; w: number; h: number; rot: number } | null {
    const item = this.items.get(id);
    if (!item) return null;
    const layout = this.liveLayout(item, now);
    const drift = this.drift.offsetFor(id, now);
    return { x: layout.x + drift.dx, y: layout.y + drift.dy, w: layout.w, h: layout.h, rot: layout.rot };
  }

  setDriftActive(active: boolean, now: number): void {
    this.drift.setActive(active, now);
  }

  hide(id: string): void {
    const item = this.items.get(id);
    if (item) item.el.style.visibility = 'hidden';
  }

  show(id: string): void {
    const item = this.items.get(id);
    if (item) item.el.style.visibility = '';
  }

  focusItem(id: string): void {
    this.items.get(id)?.el.focus();
  }

  tick(now: number, camera: { x: number; y: number }): void {
    const halfVW = this.viewportW / 2;
    const halfVH = this.viewportH / 2;
    this.container.style.transform = `translate3d(${halfVW - camera.x}px, ${halfVH - camera.y}px, 0)`;

    const cullMarginX = this.viewportW * CULL_MARGIN_VIEWPORTS;
    const cullMarginY = this.viewportH * CULL_MARGIN_VIEWPORTS;

    for (const item of this.items.values()) {
      const layout = this.liveLayout(item, now);
      const drift = this.drift.offsetFor(item.work.id, now);
      const worldX = layout.x + drift.dx;
      const worldY = layout.y + drift.dy;

      const screenX = worldX - camera.x;
      const screenY = worldY - camera.y;
      const visible =
        screenX > -halfVW - cullMarginX - layout.w &&
        screenX < halfVW + cullMarginX + layout.w &&
        screenY > -halfVH - cullMarginY - layout.h &&
        screenY < halfVH + cullMarginY + layout.h;

      if (!visible) continue;

      const scale = layout.w / item.baseW;
      const hoverScale = this.currentHoverScale(item, now);
      const px = worldX - item.baseW / 2;
      const py = worldY - item.baseH / 2;

      item.el.style.transform = `translate3d(${px}px, ${py}px, 0) rotate(${layout.rot}deg) scale(${scale * hoverScale})`;

      if (!item.hovered) {
        item.el.style.zIndex = String(layout.z ?? 0);
      }
    }
  }
}
