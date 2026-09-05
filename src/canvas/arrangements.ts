import { mulberry32 } from '../easing';

export interface ItemLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  z?: number;
}

export interface WorkMeta {
  id: string;
  ratio: { w: number; h: number };
  year: number;
}

export const BASE_AREA = 14000;

export function sizeForRatio(w: number, h: number): { w: number; h: number } {
  const ratio = w / h;
  const width = Math.sqrt(BASE_AREA * ratio);
  const height = BASE_AREA / width;
  return { w: width, h: height };
}

function recenter(layout: Map<string, ItemLayout>): void {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const l of layout.values()) {
    minX = Math.min(minX, l.x - l.w / 2);
    maxX = Math.max(maxX, l.x + l.w / 2);
    minY = Math.min(minY, l.y - l.h / 2);
    maxY = Math.max(maxY, l.y + l.h / 2);
  }
  if (!isFinite(minX)) return;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  for (const [id, l] of layout) layout.set(id, { ...l, x: l.x - cx, y: l.y - cy });
}

export function boundingBox(layout: Map<string, ItemLayout>): {
  cx: number;
  cy: number;
  w: number;
  h: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const l of layout.values()) {
    minX = Math.min(minX, l.x - l.w / 2);
    maxX = Math.max(maxX, l.x + l.w / 2);
    minY = Math.min(minY, l.y - l.h / 2);
    maxY = Math.max(maxY, l.y + l.h / 2);
  }
  if (!isFinite(minX)) return { cx: 0, cy: 0, w: 1000, h: 1000 };
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
}

/** Seeded rejection sampling, associative and meandering. */
export function solveCloud(works: WorkMeta[], viewportW: number, viewportH: number, seed = 1): Map<string, ItemLayout> {
  const rng = mulberry32(seed);
  const regionW = viewportW * 3.5;
  const regionH = viewportH * 3.5;
  const placed: { x: number; y: number; halfDiag: number }[] = [];
  const result = new Map<string, ItemLayout>();

  for (const work of works) {
    const { w, h } = sizeForRatio(work.ratio.w, work.ratio.h);
    const halfDiag = Math.sqrt(w * w + h * h) / 2;
    let factor = 1.15;
    let x = 0;
    let y = 0;
    let ok = false;

    for (let relax = 0; relax < 12 && !ok; relax++) {
      for (let attempt = 0; attempt < 400; attempt++) {
        x = (rng() - 0.5) * regionW;
        y = (rng() - 0.5) * regionH;
        let clear = true;
        for (const p of placed) {
          const minDist = (p.halfDiag + halfDiag) * factor;
          const dx = x - p.x;
          const dy = y - p.y;
          if (dx * dx + dy * dy < minDist * minDist) {
            clear = false;
            break;
          }
        }
        if (clear) {
          ok = true;
          break;
        }
      }
      factor *= 0.95;
    }

    const rot = (rng() - 0.5) * 4;
    placed.push({ x, y, halfDiag });
    result.set(work.id, { x, y, w, h, rot });
  }

  return result;
}

/** Justified rows, standard gallery algorithm. Working order. */
export function solveGrid(works: WorkMeta[], viewportW: number): Map<string, ItemLayout> {
  const rowWidthTarget = Math.max(viewportW * 2.2, 600);
  const targetRowHeight = 120;
  const gutter = 24;
  const result = new Map<string, ItemLayout>();

  type RowItem = { work: WorkMeta; naturalW: number };
  let row: RowItem[] = [];
  let y = 0;

  const rowTotalWidth = (items: RowItem[]) =>
    items.reduce((sum, it) => sum + it.naturalW, 0) + gutter * Math.max(0, items.length - 1);

  const flushRow = (isLast: boolean) => {
    if (row.length === 0) return;
    const naturalTotal = rowTotalWidth(row);
    const gutters = gutter * (row.length - 1);
    const naturalItemsWidth = naturalTotal - gutters;
    const available = rowWidthTarget - gutters;
    const overflowing = naturalItemsWidth > available;
    const scale = isLast && !overflowing ? 1 : available / naturalItemsWidth;
    let x = 0;
    let rowHeight = 0;
    for (const item of row) {
      const w = item.naturalW * scale;
      const h = targetRowHeight * scale;
      result.set(item.work.id, { x: x + w / 2, y: y + h / 2, w, h, rot: 0 });
      x += w + gutter;
      rowHeight = Math.max(rowHeight, h);
    }
    y += rowHeight + gutter;
    row = [];
  };

  for (const work of works) {
    const { w, h } = sizeForRatio(work.ratio.w, work.ratio.h);
    const naturalW = (w / h) * targetRowHeight;
    const candidate = [...row, { work, naturalW }];
    if (row.length > 0 && rowTotalWidth(candidate) > rowWidthTarget) {
      flushRow(false);
    }
    row.push({ work, naturalW });
  }
  flushRow(true);

  recenter(result);
  return result;
}

/** All items toward world origin, offset and rotated. One object with depth. */
export function solveStack(works: WorkMeta[], seed = 2): Map<string, ItemLayout> {
  const rng = mulberry32(seed);
  const sorted = [...works].sort((a, b) => b.year - a.year);
  const result = new Map<string, ItemLayout>();
  const commonWidth = 220;
  const n = sorted.length;

  sorted.forEach((work, i) => {
    const h = commonWidth * (work.ratio.h / work.ratio.w);
    const rot = (rng() - 0.5) * 1.2;
    result.set(work.id, { x: i * 1.5, y: i * 1.5, w: commonWidth, h, rot, z: n - i });
  });

  recenter(result);
  return result;
}
