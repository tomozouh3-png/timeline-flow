import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { sampleProject, newBreak, newCategory, newEvent, newPeriod, parseProject } from "../src/model.ts";
import { setMeasurer } from "../src/measure.ts";
import { layout } from "../src/layout.ts";
import { buildSvg } from "../src/svg.ts";
import { parseTsv } from "../src/tsv.ts";
import { templates } from "../src/templates.ts";
import { parseFont } from "../src/outline.ts";

setMeasurer((text, px) => text.length * px * 0.6);

test("period bar spans the right x-range and gets a lane", () => {
  const p = sampleProject();
  p.periods = [newPeriod(1, 3, "薬剤処理"), newPeriod(2, 4, "別処理")];
  const sc = layout(p);
  const xs = sc.items.map((i) => i.x); // day 0, 2, 5
  assert.equal(sc.periods.length, 2);
  const a = sc.periods[0];
  assert.ok(Math.abs(a.x0 - (xs[0] + (xs[1] - xs[0]) / 2)) < 1e-6, "start at day 1");
  assert.ok(Math.abs(a.x1 - (xs[1] + (xs[2] - xs[1]) / 3)) < 1e-6, "end at day 3");
  assert.notEqual(sc.periods[0].y, sc.periods[1].y, "overlapping periods use separate lanes");
  assert.ok(sc.H > layout(sampleProject()).H);
});

test("legend lists only used categories", () => {
  const p = sampleProject();
  const c1 = newCategory("播種", 0), c2 = newCategory("未使用", 1);
  p.categories = [c1, c2];
  p.events[0].category = c1.id;
  const sc = layout(p);
  assert.equal(sc.legend.length, 1);
  assert.equal(sc.items[0].style.fill, c1.fill);
  assert.match(buildSvg(p), /id="legend"/);
});

test("axis break compresses the interval and draws a mark", () => {
  const p = sampleProject();
  p.events = [newEvent(0, "a"), newEvent(1, "b"), newEvent(28, "c"), newEvent(29, "d")];
  const plain = layout(p).items.map((i) => i.x);
  p.breaks = [newBreak(2, 27)];
  const sc = layout(p);
  const x = sc.items.map((i) => i.x);
  assert.equal(sc.breakXs.length, 1);
  assert.ok(x[1] - x[0] > plain[1] - plain[0], "days 0-1 get more room");
  assert.ok(sc.breakXs[0] > x[1] && sc.breakXs[0] < x[2]);
});

test("TSV: events, ranges, categories, header skipped", () => {
  const p = sampleProject();
  const r = parseTsv("Day\t内容\t種別\n0\t播種\t播種\n1-3\t薬剤\t処理\nDay 5\t回収\\nPCR\t播種", p);
  assert.equal(r.skipped, 1);
  assert.equal(r.events.length, 2);
  assert.equal(r.periods.length, 1);
  assert.equal(r.events[1].t, 5);
  assert.equal(r.events[1].text, "回収\nPCR");
  assert.equal(r.categories.length, 2);
  assert.equal(r.events[0].category, r.events[1].category);
  assert.deepEqual([r.periods[0].start, r.periods[0].end], [1, 3]);
});

test("templates build valid, round-trippable projects", () => {
  for (const lang of ["ja", "en"] as const) {
    for (const t of templates(lang)) {
      const p = t.build();
      assert.ok(p.events.length >= 3);
      assert.equal(layout(p).warnings, 0, t.id);
      assert.deepEqual(parseProject(JSON.stringify(p)), p);
    }
  }
});

test("outlined SVG has paths, no <text>, keeps aria-label", { skip: !existsSync("/System/Library/Fonts/Supplemental/Arial.ttf") }, async () => {
  const buf = readFileSync("/System/Library/Fonts/Supplemental/Arial.ttf");
  const font = await parseFont(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, "Arial");
  setMeasurer((t, px) => font.advance(t, px));
  const p = sampleProject();
  p.events[0].text = "Ca^2+^ *gene* **bold**";
  p.periods = [newPeriod(1, 3, "Drug")];
  const svg = buildSvg(p, { font });
  setMeasurer((text, px) => text.length * px * 0.6);
  assert.ok(!svg.includes("<text"));
  assert.ok(svg.includes("<path d=\"M"));
  assert.ok(svg.includes('aria-label="Drug"'));
  assert.ok(svg.includes("skewX(-12)"));
});
