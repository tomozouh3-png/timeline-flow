import { runFontPx } from "./richtext.ts";
import type { Run } from "./richtext.ts";

export type Measurer = (text: string, px: number, family: string, bold: boolean, italic: boolean) => number;

let canvasCtx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();

const canvasMeasurer: Measurer = (text, px, family, bold, italic) => {
  if (!canvasCtx) canvasCtx = document.createElement("canvas").getContext("2d");
  if (!canvasCtx) return text.length * px * 0.55;
  const font = `${italic ? "italic " : ""}${bold ? "bold " : ""}${px}px ${family}`;
  const key = font + "|" + text;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  canvasCtx.font = font;
  const w = canvasCtx.measureText(text).width;
  if (cache.size > 5000) cache.clear();
  cache.set(key, w);
  return w;
};

let measurer: Measurer = canvasMeasurer;
export function setMeasurer(m: Measurer): void {
  measurer = m;
  cache.clear();
}

export function lineWidth(runs: Run[], basePx: number, family: string): number {
  let w = 0;
  for (const r of runs) w += measurer(r.text, runFontPx(r, basePx), family, r.bold, r.italic);
  return w;
}

export function useCanvasMeasurer(): void {
  setMeasurer(canvasMeasurer);
}
