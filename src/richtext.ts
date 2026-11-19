/** Tiny inline markup: **bold**, *italic*, ^superscript^, ~subscript~, {+2}bigger{/} / {-2}smaller{/}, \ escapes. */
export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  sup: boolean;
  sub: boolean;
  /** Font-size change in px relative to the base size (set by {+2} ... {/}). */
  size?: number;
}

const SIZE_TAG = /^\{([+-]\d+(?:\.\d+)?|\/)\}/;
export const MIN_PX = 4;

export function parseLine(src: string): Run[] {
  const runs: Run[] = [];
  let bold = false, italic = false, sup = false, sub = false, size = 0;
  let buf = "";
  const flush = () => {
    if (buf) runs.push(size ? { text: buf, bold, italic, sup, sub, size } : { text: buf, bold, italic, sup, sub });
    buf = "";
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\\" && i + 1 < src.length) {
      buf += src[++i];
    } else if (c === "{" && SIZE_TAG.test(src.slice(i, i + 12))) {
      const m = SIZE_TAG.exec(src.slice(i, i + 12))!;
      flush();
      size = m[1] === "/" ? 0 : Math.max(-20, Math.min(60, parseFloat(m[1])));
      i += m[0].length - 1;
    } else if (c === "*" && src[i + 1] === "*") {
      flush(); bold = !bold; i++;
    } else if (c === "*") {
      flush(); italic = !italic;
    } else if (c === "^") {
      flush(); sup = !sup; if (sup) sub = false;
    } else if (c === "~") {
      flush(); sub = !sub; if (sub) sup = false;
    } else {
      buf += c;
    }
  }
  flush();
  return runs;
}

export const SCRIPT_SCALE = 0.7;
export const SUP_SHIFT = -0.38; // em, relative to the parent font size
export const SUB_SHIFT = 0.18;

export function runFontPx(r: Run, basePx: number): number {
  const b = Math.max(MIN_PX, basePx + (r.size ?? 0));
  return r.sup || r.sub ? b * SCRIPT_SCALE : b;
}
export function runShift(r: Run, basePx: number): number {
  const b = Math.max(MIN_PX, basePx + (r.size ?? 0));
  return r.sup ? SUP_SHIFT * b : r.sub ? SUB_SHIFT * b : 0;
}
