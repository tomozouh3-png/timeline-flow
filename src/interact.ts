import { newText } from "./model.ts";
import type { EventItem, FreeText, Period, Project } from "./model.ts";
import type { Scene } from "./layout.ts";

type Part = "box" | "label" | "note" | "free" | "period" | "tip" | "attach";

export interface InteractCtx {
  host: HTMLElement; // positioned container of the preview (holds the svg host and the inline editor)
  project(): Project;
  scene(): Scene;
  edit(key?: string): void; // history + redraw
  refresh(): void; // redraw only
  commit(key: string): void; // history only
  selectEvent(id: string | null): void;
  selectFree(id: string | null): void;
  syncLists(): void; // push model text into the side-panel fields
  rebuildTexts(): void; // rebuild the free-text list in the side panel
}

export interface Interact {
  positionEditor(): void;
  stopEdit(): void;
  isEditing(): boolean;
}

const DRAG_THRESHOLD = 3;

export function setupInteractions(ctx: InteractCtx): Interact {
  const host = ctx.host;
  let editor: { ta: HTMLTextAreaElement; sel: string; fontPx: () => number; part: Part; id: string } | null = null;

  const svgEl = () => host.querySelector("svg") as SVGSVGElement | null;
  const toSvg = (e: { clientX: number; clientY: number }): { x: number; y: number } | null => {
    const svg = svgEl();
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const r = pt.matrixTransform(m.inverse());
    return { x: r.x, y: r.y };
  };
  const findEvent = (id: string): EventItem | undefined => ctx.project().events.find((e) => e.id === id);
  const findFree = (id: string): FreeText | undefined => ctx.project().texts.find((t) => t.id === id);
  const findPeriod = (id: string): Period | undefined => ctx.project().periods.find((q) => q.id === id);

  // ---------- dragging ----------
  interface Drag {
    part: Part;
    id: string;
    pointer: number;
    startX: number;
    startRelY: number;
    cx: number;
    cy: number;
    a: number; // starting offset (x)
    b: number; // starting offset (y)
    moved: boolean;
  }
  let drag: Drag | null = null;

  const targetOf = (el: Element): { part: Part; id: string } | null => {
    const g = el.closest("[data-part]");
    if (!g) return null;
    const part = g.getAttribute("data-part") as Part;
    if (part === "free") return { part, id: g.getAttribute("data-free")! };
    if (part === "period") return { part, id: g.getAttribute("data-period")! };
    const ev = g.closest("[data-ev]");
    return ev ? { part, id: ev.getAttribute("data-ev")! } : null;
  };

  host.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || (e.target as Element).closest(".inline-edit")) return;
    const tg = targetOf(e.target as Element);
    if (!tg) {
      ctx.selectEvent(null);
      ctx.selectFree(null);
      return;
    }
    if (tg.part === "free") { ctx.selectFree(tg.id); ctx.selectEvent(null); }
    else if (tg.part === "period") { ctx.selectEvent(null); ctx.selectFree(null); return; }
    else { ctx.selectEvent(tg.id); ctx.selectFree(null); }
    const pt = toSvg(e);
    if (!pt) return;
    let a = 0, b = 0;
    if (tg.part === "free") { const f = findFree(tg.id); if (!f) return; a = f.x; b = f.y; }
    else {
      const ev = findEvent(tg.id);
      if (!ev) return;
      [a, b] = tg.part === "box" ? [ev.dx, ev.dy] : tg.part === "label" ? [ev.ldx, ev.ldy] : tg.part === "tip" ? [ev.tdx, ev.tdy] : tg.part === "attach" ? [ev.adx, ev.ady] : [ev.ndx, ev.ndy];
    }
    drag = { part: tg.part, id: tg.id, pointer: e.pointerId, startX: pt.x, startRelY: pt.y - ctx.scene().axisY, cx: e.clientX, cy: e.clientY, a, b, moved: false };
    e.preventDefault(); // no text selection while dragging
  });

  host.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) < DRAG_THRESHOLD) return;
    if (!drag.moved) { try { host.setPointerCapture(e.pointerId); } catch { /* ignore */ } } // capture only once it is a real drag, so clicks keep their natural target
    drag.moved = true;
    const pt = toSvg(e);
    if (!pt) return;
    let dx = pt.x - drag.startX;
    let dy = pt.y - ctx.scene().axisY - drag.startRelY; // measured against the axis, so it is stable while the canvas grows
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    const r = (v: number) => Math.round(v * 10) / 10;
    if (drag.part === "free") {
      const f = findFree(drag.id);
      if (!f) return;
      f.x = r(drag.a + dx);
      f.y = Math.max(r(drag.b + dy), 4 - ctx.scene().axisY);
    } else {
      const ev = findEvent(drag.id);
      if (!ev) return;
      if (drag.part === "box") { ev.dx = r(drag.a + dx); ev.dy = r(drag.b + dy); }
      else if (drag.part === "label") { ev.ldx = r(drag.a + dx); ev.ldy = r(drag.b + dy); }
      else if (drag.part === "tip") { ev.tdx = r(drag.a + dx); ev.tdy = r(drag.b + dy); }
      else if (drag.part === "attach") { ev.adx = r(drag.a + dx); ev.ady = r(drag.b + dy); }
      else { ev.ndx = r(drag.a + dx); ev.ndy = r(drag.b + dy); }
    }
    ctx.refresh();
  });

  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    const moved = drag.moved;
    drag = null;
    try { host.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (moved) ctx.commit("drag");
  };
  host.addEventListener("pointerup", endDrag);
  host.addEventListener("pointercancel", endDrag);

  // ---------- inline editing ----------
  function startEdit(part: Part, id: string): void {
    stopEdit();
    const sc = ctx.scene();
    let value = "";
    let set: (v: string) => void = () => {};
    let sel = "";
    let fontPx = () => sc.fs;
    if (part === "free") {
      const f = findFree(id);
      if (!f) return;
      value = f.text; set = (v) => { f.text = v; }; sel = `[data-free="${id}"]`; fontPx = () => ctx.scene().fs;
    } else if (part === "period") {
      const q = findPeriod(id);
      if (!q) return;
      value = q.text; set = (v) => { q.text = v; }; sel = `[data-period="${id}"]`; fontPx = () => ctx.scene().lfs;
    } else {
      const ev = findEvent(id);
      if (!ev) return;
      sel = `[data-ev="${id}"] [data-part="${part}"]`;
      if (part === "box") { value = ev.text; set = (v) => { ev.text = v; }; fontPx = () => ctx.scene().fs; }
      else if (part === "note") { value = ev.note; set = (v) => { ev.note = v; }; fontPx = () => ctx.scene().lfs; }
      else {
        const it = sc.items.find((i) => i.ev.id === id);
        value = ev.labelOverride || (it ? it.label.lines.map((r) => r.map((x) => x.text).join("")).join("\n") : "");
        set = (v) => { ev.labelOverride = v; };
        fontPx = () => ctx.scene().lfs;
      }
    }
    const ta = document.createElement("textarea");
    ta.className = "inline-edit";
    ta.value = value;
    ta.spellcheck = false;
    ta.addEventListener("input", () => {
      set(ta.value);
      ctx.edit(`ie:${part}:${id}`);
      ctx.syncLists();
    });
    ta.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key === "Enter")) { e.preventDefault(); stopEdit(); }
    });
    ta.addEventListener("blur", () => stopEdit());
    host.append(ta);
    editor = { ta, sel, fontPx, part, id };
    positionEditor();
    ta.focus();
    ta.select();
  }

  function stopEdit(): void {
    if (!editor) return;
    const { ta, part, id } = editor;
    editor = null;
    ta.remove();
    if (part === "free") {
      const f = findFree(id);
      if (f && !f.text.trim()) {
        ctx.project().texts = ctx.project().texts.filter((t) => t.id !== id); // discard empty free text
        ctx.selectFree(null);
        ctx.edit();
        ctx.rebuildTexts();
        return;
      }
    }
    ctx.syncLists();
  }

  function positionEditor(): void {
    if (!editor) return;
    const el = host.querySelector(editor.sel);
    const svg = svgEl();
    if (!el || !svg) { stopEdit(); return; }
    const r = el.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const scale = svg.getBoundingClientRect().width / ctx.scene().W;
    const fpx = editor.fontPx() * scale;
    const lines = Math.max(1, editor.ta.value.split("\n").length);
    const w = Math.max(r.width + 16, 130);
    const h = Math.max(r.height + 10, lines * fpx * 1.4 + 14);
    const s = editor.ta.style;
    s.fontSize = `${fpx}px`;
    s.width = `${w}px`;
    s.height = `${h}px`;
    s.left = `${r.left - hr.left + host.scrollLeft + r.width / 2 - w / 2}px`;
    s.top = `${r.top - hr.top + host.scrollTop + r.height / 2 - h / 2}px`;
  }

  host.addEventListener("dblclick", (e) => {
    if ((e.target as Element).closest(".inline-edit")) return;
    const under = document.elementFromPoint(e.clientX, e.clientY) ?? (e.target as Element);
    const tg = targetOf(under);
    if (tg && (tg.part === "tip" || tg.part === "attach")) { // double-click a handle: back to the default position
      const ev = findEvent(tg.id);
      if (ev) { if (tg.part === "tip") ev.tdx = ev.tdy = 0; else ev.adx = ev.ady = 0; ctx.edit(); }
      return;
    }
    if (tg) { startEdit(tg.part, tg.id); return; }
    if (!svgEl()?.contains(under) && under !== host && !under.classList.contains("svghost")) return;
    // empty area: add a free text here
    const pt = toSvg(e);
    const sc = ctx.scene();
    if (!pt || pt.x < 0 || pt.y < 0 || pt.x > sc.W || pt.y > sc.H) return;
    const f = newText(Math.round(pt.x), Math.round(pt.y - sc.axisY - sc.lh / 2), "");
    ctx.project().texts.push(f);
    ctx.selectFree(f.id);
    ctx.edit();
    ctx.rebuildTexts();
    startEdit("free", f.id);
  });

  return { positionEditor, stopEdit, isEditing: () => editor !== null };
}
