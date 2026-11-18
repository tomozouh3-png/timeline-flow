/** Tiny inline markup: **bold**, *italic*, ^superscript^, ~subscript~, \ escapes. */
export interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
  sup: boolean;
  sub: boolean;
}

export function parseLine(src: string): Run[] {
  const runs: Run[] = [];
  let bold = false, italic = false, sup = false, sub = false;
  let buf = "";
  const flush = () => {
    if (buf) runs.push({ text: buf, bold, italic, sup, sub });
    buf = "";
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === "\\" && i + 1 < src.length) {
      buf += src[++i];
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
  return r.sup || r.sub ? basePx * SCRIPT_SCALE : basePx;
}
export function runShift(r: Run, basePx: number): number {
  return r.sup ? SUP_SHIFT * basePx : r.sub ? SUB_SHIFT * basePx : 0;
}
