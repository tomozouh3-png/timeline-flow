import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFont } from "../src/outline.ts";

test("bundled Noto Sans JP parses and covers JP + Latin + symbols", async () => {
  const b = readFileSync("public/fonts/NotoSansJP-Regular.otf");
  const f = await parseFont(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "Noto Sans JP");
  for (const s of ["細胞播種", "Day 5", "µg/mL", "Δα→"]) {
    assert.ok(f.advance(s, 16) > 0, s);
    assert.ok(f.pathData(s, 0, 0, 16).length > 20, s);
  }
});
