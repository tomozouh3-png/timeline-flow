import type { Project } from "./model.ts";
import { MM, PT, layout } from "./layout.ts";
import type { ItemLayout, PeriodLayout, Scene, TextBlock } from "./layout.ts";
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

/** Arrow head with its tip at `tip`, pointing away from `from`. Returns the head and the point where the shaft should end. */
function arrowHead(tip: { x: number; y: number }, from: { x: number; y: number }, size: number, color: string): { head: string; base: { x: number; y: number } } {
  const dx = tip.x - from.x, dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const bx = tip.x - ux * size * 1.6, by = tip.y - uy * size * 1.6;
  const hw = size * 0.6;
  const px = -uy * hw, py = ux * hw;
  return {
    head: `<polygon points="${num(tip.x)},${num(tip.y)} ${num(bx + px)},${num(by + py)} ${num(bx - px)},${num(by - py)}" fill="${color}"/>`,
    base: { x: bx, y: by },
  };
}

const HIT_PAD = 4;
/** Invisible (preview-only) rectangle that makes a text block easy to grab. */
function hitRect(preview: boolean, b: TextBlock | null, minW = 24): string {
  if (!preview || !b) return "";
  const w = Math.max(b.w, minW) + HIT_PAD * 2, h = Math.max(b.h, 12) + HIT_PAD * 2;
  return `<rect class="hit" x="${num(b.x - w / 2)}" y="${num(b.top - HIT_PAD)}" width="${num(w)}" height="${num(h)}" rx="3" fill="transparent"/>`;
}

function blockSvg(ctx: Ctx, b: TextBlock, lineH: number, fontPx: number): string {
  return b.lines.map((runs, i) => textLine(ctx, runs, b.x, baseline(b.top + i * lineH, fontPx, lineH), fontPx, "middle")).join("");
}

function itemSvg(ctx: Ctx, p: Project, sc: Scene, it: ItemLayout, idx: number, preview: boolean): string {
  const s = p.settings;
  const id = `event-${idx + 1}`;
  const parts: string[] = [];
  const attr = preview ? ` data-ev="${it.ev.id}"` : "";
  const part = (name: string) => (preview ? ` data-part="${name}"` : "");
  const cw = s.connector.widthPt * PT;
  const ccolor = s.axis.color;

  // time label
  parts.push(`<g id="${id}-label"${part("label")}>${hitRect(preview, it.label)}${blockSvg(ctx, it.label, sc.llh, sc.lfs)}</g>`);

  // connector: tip (axis side) -> attach (box side); both ends can be moved by hand
  if (s.connector.style !== "none") {
    const size = Math.max(5, cw * 4);
    const toAxis = s.connector.style === "toAxis";
    const hd = toAxis ? arrowHead(it.tip, it.attach, size, ccolor) : arrowHead(it.attach, it.tip, size, ccolor);
    const from = toAxis ? it.attach : it.tip;
    const handles = preview
      ? `<g class="handles"><circle data-part="tip" class="handle" cx="${num(it.tip.x)}" cy="${num(it.tip.y)}" r="9"/><circle class="dot" cx="${num(it.tip.x)}" cy="${num(it.tip.y)}" r="3.5"/><circle data-part="attach" class="handle" cx="${num(it.attach.x)}" cy="${num(it.attach.y)}" r="9"/><circle class="dot" cx="${num(it.attach.x)}" cy="${num(it.attach.y)}" r="3.5"/></g>`
      : "";
    parts.push(
      `<g id="${id}-connector"><g stroke="${ccolor}" stroke-width="${num(cw)}" fill="none"><line x1="${num(from.x)}" y1="${num(from.y)}" x2="${num(hd.base.x)}" y2="${num(hd.base.y)}"/></g>${hd.head}${handles}</g>`
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
      `<rect class="box" x="${num(b.x)}" y="${num(b.y)}" width="${num(b.w)}" height="${num(b.h)}" rx="${num(r)}" ry="${num(r)}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${num(st.strokeWidthPt * PT)}"${dash}${preview ? ' pointer-events="all"' : ""}/>`
    );
  } else if (preview) {
    box.push(`<rect class="box" x="${num(b.x)}" y="${num(b.y)}" width="${num(b.w)}" height="${num(b.h)}" fill="none" stroke="none" pointer-events="all"/>`);
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
  parts.push(`<g id="${id}-box"${part("box")}>${box.join("")}</g>`);

  // note (free text just outside the box)
  if (it.note) {
    parts.push(`<g id="${id}-note"${part("note")}>${hitRect(preview, it.note)}${blockSvg(ctx, it.note, sc.llh, sc.lfs)}</g>`);
  }
  return `<g id="${id}"${attr}>${parts.join("")}</g>`;
}

function periodSvg(ctx: Ctx, p: Project, sc: Scene, q: PeriodLayout, idx: number, preview: boolean): string {
  const sw = num(p.settings.box.strokeWidthPt * PT);
  const { x0, x1, y, h } = q;
  const shape = p.settings.period.endShape;
  let body: string;
  if (shape === "arrow") {
    const ah = Math.min(h * 0.6, (x1 - x0) / 2);
    body = `<polygon points="${num(x0)},${num(y)} ${num(x1 - ah)},${num(y)} ${num(x1)},${num(y + h / 2)} ${num(x1 - ah)},${num(y + h)} ${num(x0)},${num(y + h)}" fill="${q.fill}" stroke="${q.stroke}" stroke-width="${sw}" stroke-linejoin="round"${preview ? ' pointer-events="all"' : ""}/>`;
  } else {
    const r = shape === "round" ? h / 2 : 0;
    body = `<rect x="${num(x0)}" y="${num(y)}" width="${num(x1 - x0)}" height="${num(h)}" rx="${num(r)}" ry="${num(r)}" fill="${q.fill}" stroke="${q.stroke}" stroke-width="${sw}"${preview ? ' pointer-events="all"' : ""}/>`;
  }
  const by = baseline(y, sc.lfs, h);
  const text = q.runs.length
    ? q.inside
      ? textLine(ctx, q.runs, (x0 + x1) / 2, by, sc.lfs, "middle")
      : textLine(ctx, q.runs, x1 + 6, by, sc.lfs, "start")
    : "";
  const pa = preview ? ` data-period="${q.p.id}" data-part="period"` : "";
  return `<g id="period-${idx + 1}"${pa}>${body}${text}</g>`;
}

export function buildSvg(p: Project, opts: { preview?: boolean; scene?: Scene; font?: OutlineFont | null; freeHint?: string } = {}): string {
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
  if (preview) {
    axis.push(`<circle class="axis-handle" data-part="axisEnd" cx="${num(sc.axisEndX)}" cy="${num(sc.axisY)}" r="9"/>`);
  }
  for (const x of sc.tickXs) {
    axis.push(`<line x1="${num(x)}" y1="${num(sc.axisY - 4)}" x2="${num(x)}" y2="${num(sc.axisY + 4)}" stroke="${ac}" stroke-width="${num(aw)}"/>`);
  }

  const bg = s.background === "white" ? `<rect id="background" width="${num(sc.W)}" height="${num(sc.H)}" fill="#ffffff"/>` : "";
  const wmm = num(sc.W / MM), hmm = num(sc.H / MM);
  const body = sc.items.map((it, i) => itemSvg(ctx, p, sc, it, i, preview)).join("\n");
  const periods = sc.periods.length
    ? `<g id="periods">${sc.periods.map((q, i) => periodSvg(ctx, p, sc, q, i, preview)).join("")}</g>\n`
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
  const texts = sc.texts.length
    ? `<g id="free-texts">${sc.texts
        .map((f, i) => {
          const pa = preview ? ` data-free="${f.t.id}" data-part="free"` : "";
          return `<g id="text-${i + 1}"${pa}>${hitRect(preview, f.block, 40)}${blockSvg(ctx, f.block, sc.lh, sc.fs)}</g>`;
        })
        .join("")}</g>\n`
    : "";
  // preview-only guide for the blank space reserved at the bottom (never exported)
  const guide =
    preview && sc.freeSpace >= 12
      ? `<g class="free-guide" pointer-events="none"><rect x="6" y="${num(sc.H - sc.freeSpace - 4)}" width="${num(sc.W - 12)}" height="${num(sc.freeSpace)}" rx="6" fill="none" stroke="#9ca3af" stroke-width="1" stroke-dasharray="4 4"/>${opts.freeHint ? `<text x="${num(sc.W / 2)}" y="${num(sc.H - 12)}" text-anchor="middle" font-size="10" fill="#9ca3af">${esc(opts.freeHint)}</text>` : ""}</g>\n`
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
    texts +
    guide +
    `</svg>\n`
  );
}
