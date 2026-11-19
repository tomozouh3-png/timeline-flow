import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleProject, newText, parseProject } from "../src/model.ts";
import { setMeasurer } from "../src/measure.ts";
import { layout } from "../src/layout.ts";
import { buildSvg } from "../src/svg.ts";

setMeasurer((text, px) => text.length * px * 0.6);

test("note sits under the box and enlarges the canvas", () => {
  const base = layout(sampleProject());
  const p = sampleProject();
  p.events[0].note = "10^5^ cells/well";
  const sc = layout(p);
  const it = sc.items[0];
  assert.ok(it.note);
  assert.ok(Math.abs(it.note!.top - (it.box.y + it.box.h + 4)) < 1e-6);
  assert.ok(sc.H >= base.H);
});

test("dragging a box offsets it and slants the connector", () => {
  const p = sampleProject();
  const before = layout(p).items[1];
  p.events[1].dx = 120;
  p.events[1].dy = 30;
  const sc = layout(p);
  const it = sc.items[1];
  assert.ok(Math.abs(it.box.x - before.box.x - 120) < 1e-6);
  assert.ok(Math.abs(it.x - before.x) < 1e-6, "time position unchanged");
  const svg = buildSvg(p);
  assert.match(svg, /<line x1="[\d.]+" y1="[\d.]+" x2="[\d.]+" y2="[\d.]+"\/>/);
});

test("box dragged above the top edge shifts the figure down instead of clipping", () => {
  const p = sampleProject();
  p.events[0].dy = -400;
  const sc = layout(p);
  assert.ok(sc.items[0].box.y >= 0);
  assert.ok(sc.axisY > layout(sampleProject()).axisY);
});

test("free text: axis-relative y, preview-only guide, free space reserved", () => {
  const p = sampleProject();
  p.texts = [newText(200, 80, "Note ^*^")];
  const sc0 = layout(sampleProject());
  const sc = layout(p);
  assert.equal(sc.texts.length, 1);
  assert.ok(Math.abs(sc.texts[0].block.top - (sc.axisY + 80)) < 1e-6);
  assert.ok(sc.H - sc0.H >= 0);
  assert.ok(!buildSvg(p).includes("free-guide") && !buildSvg(p).includes("data-part"));
  assert.ok(buildSvg(p, { preview: true }).includes("free-guide"));
  assert.ok(buildSvg(p).includes('id="text-1"'));
});

test("freeSpace adds blank room at the bottom", () => {
  const p = sampleProject();
  p.settings.freeSpace = 0;
  const h0 = layout(p).H;
  p.settings.freeSpace = 100;
  assert.ok(Math.abs(layout(p).H - h0 - 100) < 1e-6);
});

test("new fields round-trip and old files load", () => {
  const p = sampleProject();
  p.events[0].note = "n";
  p.events[0].dx = 5;
  p.texts = [newText(1, 2, "t")];
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  const old = JSON.parse(JSON.stringify(p));
  delete old.texts;
  for (const e of old.events) { delete e.note; delete e.dx; }
  const q = parseProject(JSON.stringify(old));
  assert.deepEqual(q.texts, []);
  assert.equal(q.events[0].dx, 0);
});

test("arrow tip and attach point can be offset independently", () => {
  const p = sampleProject();
  const a = layout(p).items[1];
  p.events[1].tdx = 25;
  p.events[1].tdy = -10;
  p.events[1].adx = -7;
  const b = layout(p).items[1];
  assert.ok(Math.abs(b.tip.x - a.tip.x - 25) < 1e-6 && Math.abs(b.tip.y - a.tip.y + 10) < 1e-6);
  assert.ok(Math.abs(b.attach.x - a.attach.x + 7) < 1e-6);
  assert.ok(Math.abs(b.x - a.x) < 1e-6, "time position unchanged");
  assert.ok(!buildSvg(p).includes("handle"));
  assert.ok(buildSvg(p, { preview: true }).includes('data-part="tip"'));
});

import { parseLine as parseLineSize, runFontPx as fpx } from "../src/richtext.ts";
test("size tags", () => {
  const r = parseLineSize("a{+3}b{/}c\\{+1}");
  assert.deepEqual(r.map((x) => [x.text, x.size ?? 0]), [["a", 0], ["b", 3], ["c{+1}", 0]]);
  assert.equal(fpx(r[1], 10), 13);
  assert.equal(fpx(parseLineSize("{-50}x{/}")[0], 10), 4);
});

test("axis extend lengthens the arrow; export has no handles", () => {
  const p = sampleProject("ja");
  const a = layout(p).axisEndX;
  p.settings.axis.extend = 40;
  assert.equal(layout(p).axisEndX, a + 40);
  p.settings.box.fill = "none";
  const svg = buildSvg(p);
  assert.ok(!svg.includes("axis-handle") && !svg.includes("pointer-events"));
  assert.ok(svg.includes('fill="none"'));
});
