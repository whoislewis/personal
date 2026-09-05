import { clamp, easeTravel, lerp } from '../easing';
import type { ItemLayout } from './arrangements';

export const TRAVEL_DURATION_MS = 900;
const MAX_STAGGER_MS = 250;
const STAGGER_DISTANCE = 2000;

export interface TravelPlan {
  delayMs: number;
  from: ItemLayout;
  to: ItemLayout;
}

/** Near items move first: stagger by distance from the camera centre. */
export function buildTravelPlans(
  ids: Iterable<string>,
  fromLayouts: Map<string, ItemLayout>,
  toLayouts: Map<string, ItemLayout>,
  cameraX: number,
  cameraY: number,
): Map<string, TravelPlan> {
  const plans = new Map<string, TravelPlan>();
  for (const id of ids) {
    const from = fromLayouts.get(id);
    const to = toLayouts.get(id);
    if (!from || !to) continue;
    const dist = Math.hypot(from.x - cameraX, from.y - cameraY);
    const delayMs = clamp(dist / STAGGER_DISTANCE, 0, 1) * MAX_STAGGER_MS;
    plans.set(id, { delayMs, from, to });
  }
  return plans;
}

export function layoutAtTime(plan: TravelPlan, startTime: number, now: number): ItemLayout {
  const elapsed = now - startTime - plan.delayMs;
  if (elapsed <= 0) return plan.from;
  const p = clamp(elapsed / TRAVEL_DURATION_MS, 0, 1);
  const e = easeTravel(p);
  return {
    x: lerp(plan.from.x, plan.to.x, e),
    y: lerp(plan.from.y, plan.to.y, e),
    w: lerp(plan.from.w, plan.to.w, e),
    h: lerp(plan.from.h, plan.to.h, e),
    rot: lerp(plan.from.rot, plan.to.rot, e),
    z: plan.to.z,
  };
}

export function isTravelDone(plan: TravelPlan, startTime: number, now: number): boolean {
  return now - startTime - plan.delayMs >= TRAVEL_DURATION_MS;
}
