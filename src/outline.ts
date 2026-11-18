import type { Font } from "opentype.js";

/** Minimal font interface so svg.ts / measure.ts do not depend on opentype.js directly. */
export interface OutlineFont {
  name: string;
  pathData(text: string, x: number, y: number, px: number): string;
  advance(text: string, px: number): number;
}

export const BUNDLED_FONT_URL = "fonts/NotoSansJP-Regular.otf";

export async function parseFont(buf: ArrayBuffer, name: string): Promise<OutlineFont> {
  const opentype = await import("opentype.js");
  const parse = (opentype.parse ?? (opentype as unknown as { default: typeof opentype }).default.parse) as (b: ArrayBuffer) => Font;
  const font = parse(buf);
  return {
    name,
    pathData: (text, x, y, px) => font.getPath(text, x, y, px, { kerning: true }).toPathData(2),
    advance: (text, px) => font.getAdvanceWidth(text, px, { kerning: true }),
  };
}

/** Load the bundled Noto Sans JP (OFL). Returns null when the file is not deployed. */
export async function loadBundledFont(): Promise<OutlineFont | null> {
  try {
    const res = await fetch(BUNDLED_FONT_URL);
    if (!res.ok) return null;
    return await parseFont(await res.arrayBuffer(), "Noto Sans JP");
  } catch {
    return null;
  }
}
