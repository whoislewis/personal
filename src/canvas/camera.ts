import { clamp, easeTravel, lerp } from '../easing';

export interface CameraBounds {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

const FRICTION = 0.92;
const STOP_VELOCITY = 0.1;
const BOUNDARY_FACTOR = 2.5;
const SPRING = 0.08;

/** World-space camera: drag pan with momentum, elastic boundary, arrangement recentring. */
export class Camera {
  x = 0;
  y = 0;

  private vx = 0;
  private vy = 0;
  private dragging = false;
  private lastPointer = { x: 0, y: 0 };
  private bounds: CameraBounds = { cx: 0, cy: 0, w: 1000, h: 1000 };
  private recenter: null | {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    start: number;
    duration: number;
  } = null;

  setBounds(b: CameraBounds): void {
    this.bounds = b;
  }

  recentreTo(cx: number, cy: number, now: number, duration = 900): void {
    this.recenter = { fromX: this.x, fromY: this.y, toX: cx, toY: cy, start: now, duration };
    this.vx = 0;
    this.vy = 0;
  }

  jumpTo(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.recenter = null;
  }

  onPointerDown(x: number, y: number): void {
    this.dragging = true;
    this.lastPointer = { x, y };
    this.vx = 0;
    this.vy = 0;
    this.recenter = null;
  }

  onPointerMove(x: number, y: number): void {
    if (!this.dragging) return;
    const dx = x - this.lastPointer.x;
    const dy = y - this.lastPointer.y;
    this.x -= dx;
    this.y -= dy;
    this.vx = -dx;
    this.vy = -dy;
    this.lastPointer = { x, y };
  }

  onPointerUp(): void {
    this.dragging = false;
  }

  onWheel(dx: number, dy: number): void {
    this.recenter = null;
    this.x += dx;
    this.y += dy;
    this.vx = dx * 0.4;
    this.vy = dy * 0.4;
  }

  private elasticPull(rel: number, max: number): number {
    if (Math.abs(rel) <= max) return 0;
    const over = Math.abs(rel) - max;
    return Math.sign(rel) * over * SPRING;
  }

  tick(now: number): { x: number; y: number } {
    if (this.recenter) {
      const p = clamp((now - this.recenter.start) / this.recenter.duration, 0, 1);
      const e = easeTravel(p);
      this.x = lerp(this.recenter.fromX, this.recenter.toX, e);
      this.y = lerp(this.recenter.fromY, this.recenter.toY, e);
      if (p >= 1) this.recenter = null;
      return { x: this.x, y: this.y };
    }

    if (!this.dragging) {
      if (Math.abs(this.vx) > STOP_VELOCITY || Math.abs(this.vy) > STOP_VELOCITY) {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= FRICTION;
        this.vy *= FRICTION;
      } else {
        this.vx = 0;
        this.vy = 0;
      }

      const maxX = (this.bounds.w * BOUNDARY_FACTOR) / 2;
      const maxY = (this.bounds.h * BOUNDARY_FACTOR) / 2;
      this.x -= this.elasticPull(this.x - this.bounds.cx, maxX);
      this.y -= this.elasticPull(this.y - this.bounds.cy, maxY);
    }

    return { x: this.x, y: this.y };
  }
}
