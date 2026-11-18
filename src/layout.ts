import type { BoxStyle, EventItem, Period, Project } from "./model.ts";
import { parseLine } from "./richtext.ts";
import type { Run } from "./richtext.ts";
import { lineWidth } from "./measure.ts";
import { labelLines } from "./labels.ts";

export const PT = 96 / 72; // pt -> px (96 dpi user units)
export const MM = 96 / 25.4; // mm -> px

export interface ItemLayout {
  ev: EventItem;
  x: number;
  side: "above" | "below";
  tier: 0 | 1;
  style: BoxStyle;
  box: { x: number; y: number; w: number; h: number };
  textLines: Run[][];
  labelLines: Run[][];
  labelW: number;
  overlap: boolean;
}

export interface PeriodLayout {
  p: Period;
  x0: number;
  x1: number;
  y: number;
  h: number;
  fill: string;
  stroke: string;
  runs: Run[];
  inside: boolean; // label drawn inside the bar (else to the right)
  textW: number;
}

export interface LegendItem {
  x: number;
  y: number; // top of the row
  fill: string;
  stroke: string;
  runs: Run[];
}

export interface Scene {
  W: number;
  H: number;
  axisY: number;
  axisStartX: number;
  axisEndX: number; // tip of the axis
  breakXs: number[]; // centres of axis breaks
  tickXs: number[];
  items: ItemLayout[];
  periods: PeriodLayout[];
  legend: LegendItem[];
  swatchW: number;
  swatchH: number;
  fs: number;
  lfs: number;
  lh: number;
  llh: number;
  labelGap: number;
  warnings: number; // count of overlapping boxes
}

interface Prep {
  ev: EventItem;
  style: BoxStyle;
  textLines: Run[][];
  labels: Run[][];
  w: number;
  h: number;
  labelW: number;
}

interface Placed {
  x: number;
  side: "above" | "below";
  tier: 0 | 1;
  left: number;
  overlap: boolean;
}

const LABEL_PAD = 4;
const GX = 8; // minimum horizontal gap between boxes
const TIER_GAP = 10;
const LABEL_GAP = 6;
const MX = 12;
const MY = 12;
export const BREAK_KEEP = 0.6; // a collapsed interval counts as this many time units
const BAND_GAP = 14;
const LANE_GAP = 6;

export function layout(p: Project): Scene {
  const s = p.settings;
  const fs = s.fontSizePt * PT;
  const lfs = s.labelFontSizePt * PT;
  const lh = fs * 1.35;
  const llh = lfs * 1.3;
  const W = s.widthMm * MM;
  const fam = s.fontFamily;
  const ext = s.axis.arrow ? 16 : 6;
  const catOf = (id: string) => p.categories.find((c) => c.id === id);

  const evs = p.events.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i).map((o) => o.e);

  const preps: Prep[] = evs.map((ev) => {
    const cat = catOf(ev.category);
    const style: BoxStyle = {
      ...pickStyle(s.box),
      ...(cat ? { fill: cat.fill, stroke: cat.stroke } : {}),
      ...ev.style,
    };
    const textLines = ev.text.split("\n").map(parseLine);
    const tw = Math.max(0, ...textLines.map((r) => lineWidth(r, fs, fam)));
    const none = style.shape === "none";
    const w = none ? Math.max(tw, 10) : Math.max(s.box.minWidth, tw + 2 * s.box.padX);
    const h = Math.max(s.box.minHeight, textLines.length * lh + 2 * s.box.padY);
    const labels = labelLines(p, ev).map(parseLine);
    const labelW = Math.max(0, ...labels.map((r) => lineWidth(r, lfs, fam)));
    return { ev, style, textLines, labels, w, h, labelW };
  });
  if (s.box.uniformHeight) {
    const hm = Math.max(0, ...preps.map((q) => q.h));
    for (const q of preps) q.h = hm;
  }

  const n = preps.length;
  const periods = p.periods.filter((q) => isFinite(q.start) && isFinite(q.end)).map((q) => ({ ...q, start: Math.min(q.start, q.end), end: Math.max(q.start, q.end) }));
  const allT = [...preps.map((q) => q.ev.t), ...periods.flatMap((q) => [q.start, q.end])];
  const tAllMin = allT.length ? Math.min(...allT) : 0;
  const tAllMax = allT.length ? Math.max(...allT) : 0;

  // axis breaks (proportional mode only): collapse [from,to] to BREAK_KEEP units
  const breaks = s.axis.mode === "proportional"
    ? p.breaks.filter((b) => b.to - b.from > BREAK_KEEP).sort((a, b) => a.from - b.from)
    : [];
  const warp = (t: number): number =>
    t - breaks.reduce((a, b) => a + Math.min(Math.max(t - b.from, 0), b.to - b.from) * (1 - BREAK_KEEP / (b.to - b.from)), 0);
  const wMin = warp(tAllMin), wMax = warp(tAllMax);

  const half = (q: Prep) => Math.max(q.w, q.labelW) / 2;
  let padL = n && preps[0].ev.t <= tAllMin ? half(preps[0]) : 0;
  let padR = n && preps[n - 1].ev.t >= tAllMax ? half(preps[n - 1]) : 0;

  const place = () => {
    const xa = MX + padL;
    const xb = Math.max(xa, W - MX - padR - ext);
    const xOfW = (w: number) => (wMax === wMin ? (xa + xb) / 2 : xa + ((w - wMin) / (wMax - wMin)) * (xb - xa));
    // knots for equal-spacing interpolation of period ends
    const knots: { t: number; x: number }[] = [];
    if (s.axis.mode === "equal") {
      preps.forEach((q, i) => {
        const x = n === 1 ? (xa + xb) / 2 : xa + (i / (n - 1)) * (xb - xa);
        if (!knots.length || knots[knots.length - 1].t !== q.ev.t) knots.push({ t: q.ev.t, x });
      });
    }
    const mapT = (t: number): number => {
      if (s.axis.mode !== "equal") return xOfW(warp(t));
      if (!knots.length) return xa;
      if (t <= knots[0].t) return knots[0].x;
      for (let i = 1; i < knots.length; i++) {
        if (t <= knots[i].t) {
          const a = knots[i - 1], b = knots[i];
          return a.x + ((t - a.t) / (b.t - a.t)) * (b.x - a.x);
        }
      }
      return knots[knots.length - 1].x;
    };
    const xOf = (q: Prep, i: number): number => {
      if (s.axis.mode === "equal") return n === 1 ? (xa + xb) / 2 : xa + (i / (n - 1)) * (xb - xa);
      return mapT(q.ev.t);
    };

    const last: Record<string, number> = {};
    const tier0: Record<"above" | "below", { l: number; r: number }[]> = { above: [], below: [] };
    // connector x positions per side, and time-label ranges per side (labels sit opposite their box)
    const conn: Record<"above" | "below", number[]> = { above: [], below: [] };
    const labs: Record<"above" | "below", { l: number; r: number }[]> = { above: [], below: [] };
    let minX = Infinity, maxX = -Infinity;
    const placed: Placed[] = [];
    preps.forEach((q, i) => {
      const x = xOf(q, i);
      const left = x - q.w / 2;
      const wf = Math.max(q.w, q.labelW); // footprint incl. the time label
      const fits = (side: "above" | "below", tier: 0 | 1): boolean => {
        const opp = side === "above" ? "below" : "above";
        if (x - wf / 2 < (last[side + tier] ?? -Infinity) + GX) return false;
        // this label (on the opposite side) must not be crossed by an existing connector there
        if (conn[opp].some((cx) => Math.abs(cx - x) < q.labelW / 2 + LABEL_PAD)) return false;
        // this connector must not run through an existing label on its own side
        if (labs[side].some((r) => x > r.l - LABEL_PAD && x < r.r + LABEL_PAD)) return false;
        if (tier === 1) return !tier0[side].some((b) => x > b.l - 3 && x < b.r + 3);
        return true;
      };
      const fixed = q.ev.side === "above" || q.ev.side === "below" ? q.ev.side : null;
      const sides: ("above" | "below")[] = fixed
        ? [fixed]
        : s.alternate
        ? ["below", "above"] // below by default; flips to above only when it would collide
        : ["below"];
      let choice: { side: "above" | "below"; tier: 0 | 1 } | null = null;
      for (const tier of [0, 1] as const) {
        for (const side of sides) {
          if (!choice && fits(side, tier)) choice = { side, tier };
        }
      }
      const overlap = !choice;
      const c = choice ?? { side: sides[0], tier: 0 as const };
      last[c.side + c.tier] = Math.max(last[c.side + c.tier] ?? -Infinity, x + wf / 2);
      if (c.tier === 0) tier0[c.side].push({ l: left, r: left + q.w });
      conn[c.side].push(x);
      labs[c.side === "above" ? "below" : "above"].push({ l: x - q.labelW / 2, r: x + q.labelW / 2 });
      placed.push({ x, side: c.side, tier: c.tier, left, overlap });
      minX = Math.min(minX, left, x - q.labelW / 2);
      maxX = Math.max(maxX, left + q.w, x + q.labelW / 2);
    });
    return { placed, xa, xb, minX, maxX, mapT, xOfW };
  };

  let res = place();
  for (let pass = 0; pass < 3 && n; pass++) {
    const oL = Math.max(0, MX - res.minX);
    const oR = Math.max(0, res.maxX - (W - MX));
    if (oL < 0.5 && oR < 0.5) break;
    padL += oL;
    padR += oR;
    res = place();
  }

  // ---- vertical: events ----
  const labelBlockH = Math.max(0, ...preps.map((q) => q.labels.length * llh));
  const c = Math.max(s.connector.length, labelBlockH + LABEL_GAP + 8);
  const tier0H = { above: 0, below: 0 };
  preps.forEach((q, i) => {
    const pl = res.placed[i];
    if (pl.tier === 0) tier0H[pl.side] = Math.max(tier0H[pl.side], q.h);
  });
  const offsetOf = (tier: 0 | 1, side: "above" | "below") => (tier === 0 ? c : c + tier0H[side] + TIER_GAP);
  const extent = { above: 8, below: 8 };
  preps.forEach((q, i) => {
    const pl = res.placed[i];
    extent[pl.side] = Math.max(extent[pl.side], offsetOf(pl.tier, pl.side) + q.h);
    const opp = pl.side === "above" ? "below" : "above"; // label sits on the opposite side of the axis
    extent[opp] = Math.max(extent[opp], q.labels.length * llh + LABEL_GAP);
  });

  // ---- period lanes ----
  const ph = s.period.height;
  const pl: PeriodLayout[] = [];
  const laneRight: number[] = [];
  for (const q of [...periods].sort((a, b) => a.start - b.start || a.end - b.end)) {
    const cat = catOf(q.category);
    const x0 = res.mapT(q.start);
    const x1 = Math.max(res.mapT(q.end), x0 + 4);
    const runs = parseLine(q.text);
    const tw = lineWidth(runs, lfs, fam);
    const inside = tw + 12 <= x1 - x0;
    const foot = inside ? x1 : x1 + 6 + tw;
    let lane = laneRight.findIndex((r) => x0 >= r + GX);
    if (lane < 0) { lane = laneRight.length; laneRight.push(0); }
    laneRight[lane] = foot;
    pl.push({
      p: q, x0, x1, y: lane, h: ph, runs, inside, textW: tw,
      fill: q.fill || cat?.fill || s.period.fill,
      stroke: cat?.stroke || s.period.stroke,
    });
  }
  const lanes = laneRight.length;
  const bandH = lanes ? lanes * (ph + LANE_GAP) - LANE_GAP : 0;
  const topBand = s.period.position === "top" && lanes ? bandH + BAND_GAP : 0;
  const axisY = MY + topBand + extent.above;
  let yCursor = axisY + extent.below;
  const bandTop = s.period.position === "top" ? MY : yCursor + BAND_GAP;
  for (const q of pl) q.y = bandTop + q.y * (ph + LANE_GAP);
  if (lanes && s.period.position === "bottom") yCursor = bandTop + bandH;

  // ---- legend ----
  const usedIds = new Set<string>([...preps.map((q) => q.ev.category), ...periods.map((q) => q.category)]);
  const legendCats = p.categories.filter((cc) => usedIds.has(cc.id) && cc.name.trim());
  const swatchW = 18, swatchH = 11;
  const legend: LegendItem[] = [];
  if (s.legend && legendCats.length) {
    let x = MX, row = 0;
    for (const cc of legendCats) {
      const runs = parseLine(cc.name);
      const w = swatchW + 6 + lineWidth(runs, lfs, fam);
      if (x > MX && x + w > W - MX) { x = MX; row++; }
      legend.push({ x, y: row * (llh + 4), fill: cc.fill, stroke: cc.stroke, runs });
      x += w + 18;
    }
    const legendH = (row + 1) * (llh + 4) - 4;
    const top = yCursor + BAND_GAP;
    for (const it of legend) it.y += top;
    yCursor = top + legendH;
  }
  const H = yCursor + MY;

  const items: ItemLayout[] = preps.map((q, i) => {
    const pp = res.placed[i];
    const off = offsetOf(pp.tier, pp.side);
    const y = pp.side === "below" ? axisY + off : axisY - off - q.h;
    return {
      ev: q.ev, x: pp.x, side: pp.side, tier: pp.tier, style: q.style,
      box: { x: pp.left, y, w: q.w, h: q.h },
      textLines: q.textLines, labelLines: q.labels, labelW: q.labelW, overlap: pp.overlap,
    };
  });

  // ---- axis break marks & ticks ----
  const breakXs: number[] = [];
  for (const b of breaks) {
    const x = res.xOfW(warp(b.from) + BREAK_KEEP / 2);
    if (x > res.xa && x < res.xb) breakXs.push(x);
  }
  const tickXs: number[] = [];
  if (s.axis.ticks === "events" || (s.axis.ticks === "unit" && s.axis.mode === "equal")) {
    for (const it of items) tickXs.push(it.x);
  } else if (s.axis.ticks === "unit" && allT.length > 1 && tAllMax > tAllMin && tAllMax - tAllMin <= 120) {
    for (let t = Math.ceil(tAllMin); t <= tAllMax + 1e-9; t++) {
      if (breaks.some((b) => t > b.from && t < b.to)) continue;
      tickXs.push(res.mapT(t));
    }
  }

  return {
    W, H, axisY,
    axisStartX: MX,
    axisEndX: res.xb + ext,
    breakXs, tickXs, items, periods: pl, legend, swatchW, swatchH,
    fs, lfs, lh, llh, labelGap: LABEL_GAP,
    warnings: items.filter((i) => i.overlap).length,
  };
}

function pickStyle(b: Project["settings"]["box"]): BoxStyle {
  return { fill: b.fill, stroke: b.stroke, strokeWidthPt: b.strokeWidthPt, dashed: b.dashed, radius: b.radius, shape: b.shape };
}
