import type { Project } from "./model.ts";
import { MM, PT, layout } from "./layout.ts";
import type { ItemLayout, PeriodLayout, Scene } from "./layout.ts";
import { runFontPx, runShift } from "./richtext.ts";
import type { Run } from "./richtext.ts";
import type { OutlineFont } from "./outline.ts";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const num = (v: number) => String(Math.round(v * 100) / 100);
const TEXT_COLOR = "#111111";
const plain = (runs: Run[]) => runs.map((r) => r.text).join("");

interface Ctx {
  font: OutlineFont | null;
}

function textLine(ctx: Ctx, runs: Run[], x: number, y: number, basePx: number, anchor: "start" | "middle"): string {
  if (ctx.font) return outlineLine(ctx.font, runs, x, y, basePx, anchor);
  let prevShift = 0;
  const spans = runs
    .map((r) => {
      const shift = runShift(r, basePx);
      const attrs: string[] = [];
      if (shift !== prevShift) attrs.push(`dy="${num(shift - prevShift)}"`);
      prevShift = shift;
      const px = runFontPx(r, basePx);
      if (px !== basePx) attrs.push(`font-size="${num(px)}"`);
      if (r.bold) attrs.push('font-weight="bold"');
      if (r.italic) attrs.push('font-style="italic"');
      return `<tspan${attrs.length ? " " + attrs.join(" ") : ""}>${esc(r.text)}</tspan>`;
    })
    .join("");
  return `<text x="${num(x)}" y="${num(y)}" text-anchor="${anchor}" font-size="${num(basePx)}" fill="${TEXT_COLOR}" xml:space="preserve">${spans}</text>`;
}

/** Text converted to <path> outlines (keeps the original string in aria-label). */
function outlineLine(font: OutlineFont, runs: Run[], x: number, y: number, basePx: number, anchor: "start" | "middle"): string {
  const widths = runs.map((r) => font.advance(r.text, runFontPx(r, basePx)));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = anchor === "middle" ? x - total / 2 : x;
  const paths = runs.map((r, i) => {
    const px = runFontPx(r, basePx);
    const by = y + runShift(r, basePx);
    const d = font.pathData(r.text, cx, by, px);
    const attrs: string[] = [`d="${d}"`];
    if (r.bold) attrs.push(`stroke="${TEXT_COLOR}" stroke-width="${num(px * 0.035)}" stroke-linejoin="round"`);
    if (r.italic) attrs.push(`transform="translate(${num(cx)} ${num(by)}) skewX(-12) translate(${num(-cx)} ${num(-by)})"`);
    cx += widths[i];
    return /^\s*$/.test(r.text) ? "" : `<path ${attrs.join(" ")}/>`;
  });
  return `<g aria-label="${esc(plain(runs))}" fill="${TEXT_COLOR}">${paths.join("")}</g>`;
}

const baseline = (top: number, fs: number, lh: number) => top + (lh - fs) / 2 + fs * 0.8;

function arrowHead(tipX: number, tipY: number, dirY: -1 | 1, size: number, color: string): string {
  // triangle whose tip is at (tipX, tipY) and which points in direction dirY
  const by = tipY - dirY * size * 1.6;
  const hw = size * 0.6;
  return `<polygon points="${num(tipX)},${num(tipY)} ${num(tipX - hw)},${num(by)} ${num(tipX + hw)},${num(by)}" fill="${color}"/>`;
}

function itemSvg(ctx: Ctx, p: Project, sc: Scene, it: ItemLayout, idx: number, preview: boolean): string {
  const s = p.settings;
  const id = `event-${idx + 1}`;
  const parts: string[] = [];
  const attr = preview ? ` data-ev="${it.ev.id}"` : "";
  const cw = s.connector.widthPt * PT;
  const ccolor = s.axis.color;

  // time label (opposite side of the box)
  const n = it.labelLines.length;
  const labelTop = it.side === "below" ? sc.axisY - sc.labelGap - n * sc.llh : sc.axisY + sc.labelGap;
  const lab = it.labelLines
    .map((runs, i) => textLine(ctx, runs, it.x, baseline(labelTop + i * sc.llh, sc.lfs, sc.llh), sc.lfs, "middle"))
    .join("");
  parts.push(`<g id="${id}-label">${lab}</g>`);

  // connector
  if (s.connector.style !== "none") {
    const edgeY = it.side === "below" ? it.box.y : it.box.y + it.box.h;
    const head = Math.max(5, cw * 4);
    const dir: -1 | 1 = it.side === "below" ? -1 : 1; // direction pointing toward the axis
    let line: string, tip: string;
    if (s.connector.style === "toAxis") {
      // arrow tip sits exactly on the axis
      const lineEnd = sc.axisY - dir * head * 1.6;
      line = `<line x1="${num(it.x)}" y1="${num(edgeY)}" x2="${num(it.x)}" y2="${num(lineEnd)}"/>`;
      tip = arrowHead(it.x, sc.axisY, dir, head, ccolor);
    } else {
      // arrow tip sits on the box edge
      const lineEnd = edgeY + dir * head * 1.6;
      line = `<line x1="${num(it.x)}" y1="${num(sc.axisY)}" x2="${num(it.x)}" y2="${num(lineEnd)}"/>`;
      tip = arrowHead(it.x, edgeY, (dir * -1) as -1 | 1, head, ccolor);
    }
    parts.push(
      `<g id="${id}-connector"><g stroke="${ccolor}" stroke-width="${num(cw)}" fill="none">${line}</g>${tip}</g>`
    );
  }

  // box
  const b = it.box;
  const st = it.style;
  const box: string[] = [];
  if (st.shape !== "none") {
    const r = st.shape === "rounded" ? Math.min(st.radius, b.w / 2, b.h / 2) : 0;
    const dash = st.dashed ? ` stroke-dasharray="${num(4 * PT)} ${num(3 * PT)}"` : "";
    box.push(
      `<rect class="box" x="${num(b.x)}" y="${num(b.y)}" width="${num(b.w)}" height="${num(b.h)}" rx="${num(r)}" ry="${num(r)}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${num(st.strokeWidthPt * PT)}"${dash}/>`
    );
  } else if (preview) {
    box.push(`<rect class="box" x="${num(b.x)}" y="${num(b.y)}" width="${num(b.w)}" height="${num(b.h)}" fill="none" stroke="none"/>`);
  }
  const textH = it.textLines.length * sc.lh;
  const top = s.box.valign === "middle" ? b.y + (b.h - textH) / 2 : b.y + s.box.padY;
  const left = s.box.align === "left";
  const tx = left ? b.x + s.box.padX : b.x + b.w / 2;
  box.push(
    it.textLines
      .map((runs, i) => textLine(ctx, runs, tx, baseline(top + i * sc.lh, sc.fs, sc.lh), sc.fs, left ? "start" : "middle"))
      .join("")
  );
  parts.push(`<g id="${id}-box">${box.join("")}</g>`);
  return `<g id="${id}"${attr}>${parts.join("")}</g>`;
}

function periodSvg(ctx: Ctx, p: Project, sc: Scene, q: PeriodLayout, idx: number): string {
  const sw = num(p.settings.box.strokeWidthPt * PT);
  const { x0, x1, y, h } = q;
  const shape = p.settings.period.endShape;
  let body: string;
  if (shape === "arrow") {
    const ah = Math.min(h * 0.6, (x1 - x0) / 2);
    body = `<polygon points="${num(x0)},${num(y)} ${num(x1 - ah)},${num(y)} ${num(x1)},${num(y + h / 2)} ${num(x1 - ah)},${num(y + h)} ${num(x0)},${num(y + h)}" fill="${q.fill}" stroke="${q.stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  } else {
    const r = shape === "round" ? h / 2 : 0;
    body = `<rect x="${num(x0)}" y="${num(y)}" width="${num(x1 - x0)}" height="${num(h)}" rx="${num(r)}" ry="${num(r)}" fill="${q.fill}" stroke="${q.stroke}" stroke-width="${sw}"/>`;
  }
  const by = baseline(y, sc.lfs, h);
  const text = q.runs.length
    ? q.inside
      ? textLine(ctx, q.runs, (x0 + x1) / 2, by, sc.lfs, "middle")
      : textLine(ctx, q.runs, x1 + 6, by, sc.lfs, "start")
    : "";
  return `<g id="period-${idx + 1}">${body}${text}</g>`;
}

export function buildSvg(p: Project, opts: { preview?: boolean; scene?: Scene; font?: OutlineFont | null } = {}): string {
  const preview = !!opts.preview;
  const ctx: Ctx = { font: opts.font ?? null };
  const sc = opts.scene ?? layout(p);
  const s = p.settings;
  const aw = s.axis.widthPt * PT;
  const ac = s.axis.color;
  const head = Math.max(6, aw * 4.5);

  const axis: string[] = [];
  const lineEnd = s.axis.arrow ? sc.axisEndX - head * 1.6 : sc.axisEndX;
  const BG = 7; // half gap at an axis break
  const bounds = [sc.axisStartX, ...sc.breakXs.flatMap((x) => [x - BG, x + BG]), lineEnd];
  for (let i = 0; i + 1 < bounds.length; i += 2) {
    axis.push(
      `<line x1="${num(bounds[i])}" y1="${num(sc.axisY)}" x2="${num(bounds[i + 1])}" y2="${num(sc.axisY)}" stroke="${ac}" stroke-width="${num(aw)}"/>`
    );
  }
  for (const bx of sc.breakXs) {
    for (const k of [-2.5, 2.5]) {
      axis.push(
        `<line x1="${num(bx + k - 3)}" y1="${num(sc.axisY + 7)}" x2="${num(bx + k + 3)}" y2="${num(sc.axisY - 7)}" stroke="${ac}" stroke-width="${num(aw)}" stroke-linecap="round"/>`
      );
    }
  }
  if (s.axis.arrow) {
    const hw = head * 0.6;
    axis.push(
      `<polygon points="${num(sc.axisEndX)},${num(sc.axisY)} ${num(lineEnd)},${num(sc.axisY - hw)} ${num(lineEnd)},${num(sc.axisY + hw)}" fill="${ac}"/>`
    );
  }
  for (const x of sc.tickXs) {
    axis.push(`<line x1="${num(x)}" y1="${num(sc.axisY - 4)}" x2="${num(x)}" y2="${num(sc.axisY + 4)}" stroke="${ac}" stroke-width="${num(aw)}"/>`);
  }

  const bg = s.background === "white" ? `<rect id="background" width="${num(sc.W)}" height="${num(sc.H)}" fill="#ffffff"/>` : "";
  const wmm = num(sc.W / MM), hmm = num(sc.H / MM);
  const body = sc.items.map((it, i) => itemSvg(ctx, p, sc, it, i, preview)).join("\n");
  const periods = sc.periods.length
    ? `<g id="periods">${sc.periods.map((q, i) => periodSvg(ctx, p, sc, q, i)).join("")}</g>\n`
    : "";
  const legend = sc.legend.length
    ? `<g id="legend">${sc.legend
        .map((it, i) => {
          const sw = num(p.settings.box.strokeWidthPt * PT);
          const rh = sc.swatchH;
          const ty = baseline(it.y, sc.lfs, sc.llh);
          return `<g id="legend-${i + 1}"><rect x="${num(it.x)}" y="${num(it.y + (sc.llh - rh) / 2)}" width="${sc.swatchW}" height="${rh}" rx="3" fill="${it.fill}" stroke="${it.stroke}" stroke-width="${sw}"/>${textLine(ctx, it.runs, it.x + sc.swatchW + 6, ty, sc.lfs, "start")}</g>`;
        })
        .join("")}</g>\n`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${num(sc.W)} ${num(sc.H)}" width="${wmm}mm" height="${hmm}mm" font-family="${esc(s.fontFamily)}">\n` +
    `<title>Experiment timeline</title>\n` +
    bg +
    `<g id="axis">${axis.join("")}</g>\n` +
    periods +
    body +
    `\n` +
    legend +
    `</svg>\n`
  );
}
