import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleProject, newEvent, parseProject } from "../src/model.ts";
import { setMeasurer } from "../src/measure.ts";
import { layout } from "../src/layout.ts";
import { buildSvg } from "../src/svg.ts";
import { parseLine } from "../src/richtext.ts";
import { dateOf, tOfDate, labelLines } from "../src/labels.ts";

setMeasurer((text, px) => text.length * px * 0.6);

test("richtext parses sup/sub/italic/bold/escape", () => {
  const r = parseLine("Ca^2+^ *BGLF4* **x** \\*y");
  assert.deepEqual(r.map((x) => [x.text, x.sup, x.italic, x.bold]), [
    ["Ca", false, false, false], ["2+", true, false, false], [" ", false, false, false],
    ["BGLF4", false, true, false], [" ", false, false, false], ["x", false, false, true], [" *y", false, false, false],
  ]);
});

test("reference figure: 3 events, proportional x", () => {
  const sc = layout(sampleProject());
  assert.equal(sc.items.length, 3);
  const [a, b, c] = sc.items.map((i) => i.x);
  assert.ok(Math.abs((b - a) / (c - b) - 2 / 3) < 1e-6);
  assert.equal(sc.warnings, 0);
  for (const it of sc.items) {
    assert.ok(it.box.x >= 0 && it.box.x + it.box.w <= sc.W, "box inside canvas");
  }
});

test("equal spacing", () => {
  const p = sampleProject();
  p.settings.axis.mode = "equal";
  const [a, b, c] = layout(p).items.map((i) => i.x);
  assert.ok(Math.abs(b - a - (c - b)) < 1e-6);
});

test("close events alternate above/below without overlap", () => {
  const p = sampleProject();
  p.events = [0, 0.5, 1, 5].map((t, i) => newEvent(t, "long text " + i));
  const sc = layout(p);
  assert.equal(sc.warnings, 0);
  const sides = new Set(sc.items.map((i) => i.side));
  assert.equal(sides.size, 2);
  for (const side of ["above", "below"] as const) {
    for (const tier of [0, 1] as const) {
      const row = sc.items.filter((i) => i.side === side && i.tier === tier).sort((a, b) => a.box.x - b.box.x);
      for (let i = 1; i < row.length; i++) assert.ok(row[i].box.x >= row[i - 1].box.x + row[i - 1].box.w);
    }
  }
});

test("dates: Day 0 = 2026-11-18", () => {
  const p = sampleProject();
  p.settings.date.start = "2026-11-18";
  p.settings.date.mode = "both";
  assert.equal(dateOf(p, 2)?.getDate(), 20);
  assert.equal(tOfDate(p, "2026-11-23"), 5);
  assert.deepEqual(labelLines(p, p.events[1]), ["Day 2 (11/20)"]);
  p.settings.date.layout = "twoline";
  assert.deepEqual(labelLines(p, p.events[1]), ["Day 2", "11/20"]);
});

test("SVG is well-formed and round-trips JSON", () => {
  const p = sampleProject();
  p.events[0].text = "Ca^2+^ & <x>";
  const svg = buildSvg(p);
  assert.match(svg, /^<svg xmlns=/);
  assert.ok(svg.includes("&amp;") && svg.includes("&lt;x&gt;"));
  assert.ok(svg.includes('id="event-1-box"'));
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
});
