import "./styles.css";
import { newBreak, newCategory, newEvent, newPeriod, newText, parseProject, sampleProject } from "./model.ts";
import { setupInteractions } from "./interact.ts";
import type { Interact } from "./interact.ts";
import type { Project, EventItem } from "./model.ts";
import { setMeasurer, useCanvasMeasurer } from "./measure.ts";
import { loadBundledFont, parseFont } from "./outline.ts";
import type { OutlineFont } from "./outline.ts";
import { parseTsv } from "./tsv.ts";
import { templates } from "./templates.ts";
import { layout } from "./layout.ts";
import type { Scene } from "./layout.ts";
import { buildSvg } from "./svg.ts";
import { History } from "./history.ts";
import { detectLang, getLang, overlapWarn, saveLang, setLang, t } from "./i18n.ts";
import type { Lang } from "./i18n.ts";
import { deleteLib, getCurrent, listLib, renameLib, saveLib, setCurrent } from "./library.ts";
import { dateOf, supportsDate, tOfDate } from "./labels.ts";

const STORE_KEY = "timelineflow:project:v1";

// ---------- state ----------
let project: Project = loadStored() ?? sampleProject();
const hist = new History();
hist.reset(project);
let selectedId: string | null = null;
let lastRt: HTMLInputElement | HTMLTextAreaElement | null = null;
let previewEl!: HTMLElement;
let warnEl!: HTMLElement;
let listEl!: HTMLElement;
let undoBtn!: HTMLButtonElement;
let redoBtn!: HTMLButtonElement;
let saveTimer = 0;
let svgHost!: HTMLElement;
let interact: Interact | null = null;
let selectedFree: string | null = null;
let textsRebuild: () => void = () => {};
let lastScene: Scene | null = null;
let outlineFont: OutlineFont | null = null;
let fontStatusEl: HTMLElement | null = null;
let tsvDialog!: HTMLDialogElement;
let libDialog!: HTMLDialogElement;
let curFileEl: HTMLElement | null = null;

function loadStored(): Project | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? parseProject(raw) : null;
  } catch {
    return null;
  }
}
function autosave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(project)); } catch { /* ignore */ }
  }, 300);
}

// ---------- tiny DOM helper ----------
type Props = Record<string, unknown>;
function h<T extends keyof HTMLElementTagNameMap>(tag: T, props: Props = {}, ...kids: (Node | string | null)[]): HTMLElementTagNameMap[T] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "value" || k === "checked" || k === "disabled" || k === "selected") (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of kids) if (c !== null) el.append(c);
  return el;
}
const field = (label: string, ...ctl: Node[]) => h("label", { class: "fld" }, h("span", {}, label), ...ctl);

// ---------- core actions ----------
function edit(key = ""): void {
  hist.commit(project, key);
  refresh();
}

function refresh(): void {
  const scene = layout(project);
  lastScene = scene;
  svgHost.innerHTML = buildSvg(project, { preview: true, scene, freeHint: t("freeHint") });
  previewEl.classList.toggle("checker", project.settings.background === "transparent");
  markSelected();
  interact?.positionEditor();
  warnEl.textContent = scene.warnings ? overlapWarn(scene.warnings) : project.events.length ? "" : t("empty");
  undoBtn.disabled = !hist.canUndo();
  redoBtn.disabled = !hist.canRedo();
  autosave();
}

function markSelected(): void {
  previewEl.querySelectorAll(".tl-sel").forEach((e) => e.classList.remove("tl-sel"));
  listEl.querySelectorAll(".ev.sel").forEach((e) => e.classList.remove("sel"));
  if (selectedFree) previewEl.querySelector(`[data-free="${selectedFree}"]`)?.classList.add("tl-sel");
  if (!selectedId) return;
  previewEl.querySelector(`[data-ev="${selectedId}"]`)?.classList.add("tl-sel");
  listEl.querySelector(`.ev[data-id="${selectedId}"]`)?.classList.add("sel");
}

function select(id: string, scroll: boolean): void {
  selectedId = id;
  markSelected();
  if (scroll) {
    const row = listEl.querySelector(`.ev[data-id="${id}"]`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function restore(snap: string | null): void {
  if (!snap) return;
  project = parseProject(snap);
  renderAll();
}

function download(name: string, mime: string, data: string): void {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- settings bindings ----------
function getPath(path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], project.settings);
}
function setPath(path: string, v: unknown): void {
  const ks = path.split(".");
  const last = ks.pop()!;
  const obj = ks.reduce<Record<string, unknown>>((o, k) => o[k] as Record<string, unknown>, project.settings as unknown as Record<string, unknown>);
  obj[last] = v;
}

function numIn(path: string, label: string, step = 1, min = 0): HTMLElement {
  const i = h("input", { type: "number", step, min, value: String(getPath(path)) });
  i.dataset.path = path;
  i.addEventListener("input", () => {
    const v = parseFloat(i.value);
    if (!isFinite(v)) return;
    setPath(path, v);
    edit("s:" + path);
  });
  return field(label, i);
}
function selIn(path: string, label: string, opts: [string, string][]): HTMLElement {
  const s = h("select", {}, ...opts.map(([v, l]) => h("option", { value: v, selected: getPath(path) === v }, l)));
  s.addEventListener("change", () => { setPath(path, s.value); edit(); });
  return field(label, s);
}
function chkIn(path: string, label: string): HTMLElement {
  const c = h("input", { type: "checkbox", checked: !!getPath(path) });
  c.addEventListener("change", () => { setPath(path, c.checked); edit(); });
  return h("label", { class: "fld chk" }, c, h("span", {}, label));
}
/** Colour picker with a "transparent" checkbox (stored as "none"). `fallback` is the colour restored when transparency is switched off. */
function clrPick(value: string, fallback: string, onChange: (v: string) => void): HTMLElement {
  const none = value === "none";
  const c = h("input", { type: "color", value: none ? fallback : value || fallback });
  const n = h("input", { type: "checkbox", checked: none });
  c.disabled = none;
  c.addEventListener("input", () => onChange(c.value));
  n.addEventListener("change", () => { c.disabled = n.checked; onChange(n.checked ? "none" : c.value); });
  return h("span", { class: "clr" }, c, h("label", { class: "none" }, n, t("transparent")));
}
function colIn(path: string, label: string, canNone = false): HTMLElement {
  if (canNone) {
    const cur = String(getPath(path));
    return field(label, clrPick(cur, cur === "none" ? "#ffffff" : cur, (v) => { setPath(path, v); edit("s:" + path); }));
  }
  const c = h("input", { type: "color", value: String(getPath(path)) });
  c.addEventListener("input", () => { setPath(path, c.value); edit("s:" + path); });
  return field(label, c);
}
function textIn(path: string, label: string, list?: string): HTMLElement {
  const i = h("input", { type: "text", value: String(getPath(path)), list });
  i.addEventListener("input", () => { setPath(path, i.value); edit("s:" + path); });
  return field(label, i);
}
function dateIn(path: string, label: string): HTMLElement {
  const i = h("input", { type: "date", value: String(getPath(path)) });
  i.addEventListener("change", () => { setPath(path, i.value); edit(); renderList(); });
  return field(label, i);
}

const FONTS = [
  'Arial, Helvetica, "Hiragino Sans", "Yu Gothic", sans-serif',
  '"Hiragino Sans", "Yu Gothic", Meiryo, sans-serif',
  '"Noto Sans JP", sans-serif',
  '"Times New Roman", "Hiragino Mincho ProN", serif',
  '"Helvetica Neue", Helvetica, Arial, sans-serif',
];

function group(title: string, open: boolean, ...kids: Node[]): HTMLElement {
  return h("details", { class: "grp", open }, h("summary", {}, title), h("div", { class: "grid" }, ...kids));
}

function buildSettings(): HTMLElement {
  const dateHint = h("p", { class: "hint" }, t("dateNeedStart"));
  return h(
    "div",
    { class: "settings" },
    h("h2", {}, t("settings")),
    group(t("gCanvas"), true,
      numIn("widthMm", t("widthMm"), 5, 40),
      textIn("fontFamily", t("font"), "fontlist"),
      h("datalist", { id: "fontlist" }, ...FONTS.map((f) => h("option", { value: f }))),
      numIn("fontSizePt", t("fontSize"), 0.5, 4),
      numIn("labelFontSizePt", t("labelFontSize"), 0.5, 4),
      selIn("background", t("background"), [["transparent", t("bgTransparent")], ["white", t("bgWhite")]]),
      numIn("freeSpace", t("freeSpace"), 4, 0),
      chkIn("alternate", t("alternate"))
    ),
    group(t("gAxis"), true,
      selIn("axis.unit", t("unit"), [["Day", "Day"], ["Hour", "Hour"], ["Week", "Week"], ["Month", "Month"], ["custom", t("unitCustom")]]),
      textIn("axis.customUnit", t("customUnit")),
      selIn("axis.mode", t("mode"), [["proportional", t("modeProportional")], ["equal", t("modeEqual")]]),
      selIn("axis.ticks", t("ticks"), [["none", t("ticksNone")], ["events", t("ticksEvents")], ["unit", t("ticksUnit")]]),
      chkIn("axis.arrow", t("arrow")),
      numIn("axis.extend", t("axisExtend"), 4, -10),
      numIn("axis.widthPt", t("axisWidth"), 0.25, 0.25),
      colIn("axis.color", t("axisColor"))
    ),
    group(t("gDate"), true,
      dateIn("date.start", t("dateStart")),
      selIn("date.mode", t("dateMode"), [["none", t("dateNone")], ["date", t("dateOnly")], ["both", t("dateBoth")]]),
      selIn("date.format", t("dateFormat"), [["MM/DD", "MM/DD"], ["YYYY/MM/DD", "YYYY/MM/DD"], ["D MMM", "D MMM"]]),
      selIn("date.layout", t("dateLayout"), [["inline", t("layoutInline")], ["twoline", t("layoutTwoline")]]),
      dateHint
    ),
    group(t("gBox"), false,
      colIn("box.fill", t("fill"), true),
      colIn("box.stroke", t("stroke"), true),
      numIn("box.strokeWidthPt", t("strokeWidth"), 0.25, 0),
      chkIn("box.dashed", t("dashed")),
      selIn("box.shape", t("shape"), [["rounded", t("shapeRounded")], ["rect", t("shapeRect")], ["none", t("shapeNone")]]),
      numIn("box.radius", t("radius"), 1, 0),
      numIn("box.minWidth", t("minWidth"), 5, 0),
      numIn("box.minHeight", t("minHeight"), 5, 0),
      numIn("box.padX", t("padX"), 1, 0),
      numIn("box.padY", t("padY"), 1, 0),
      selIn("box.align", t("align"), [["center", t("alignCenter")], ["left", t("alignLeft")]]),
      selIn("box.valign", t("valign"), [["top", t("valignTop")], ["middle", t("valignMiddle")]]),
      chkIn("box.uniformHeight", t("uniformHeight"))
    ),
    group(t("gPeriod"), false,
      chkIn("legend", t("legend")),
      selIn("period.position", t("periodPos"), [["bottom", t("posBottom")], ["top", t("posTop")]]),
      numIn("period.height", t("periodHeight"), 1, 6),
      selIn("period.endShape", t("endShape"), [["square", t("shapeSquare")], ["round", t("shapeRound")], ["arrow", t("shapeArrow")]]),
      numIn("period.arrowLen", t("arrowLen"), 1, 0),
      colIn("period.fill", t("fill"), true),
      colIn("period.stroke", t("stroke"), true)
    ),
    group(t("gConn"), false,
      selIn("connector.style", t("connStyle"), [["toAxis", t("connToAxis")], ["toBox", t("connToBox")], ["none", t("connNone")]]),
      numIn("connector.length", t("connLength"), 2, 10),
      numIn("connector.widthPt", t("connWidth"), 0.25, 0.25)
    ),
    buildFontGroup()
  );
}

// ---------- rich-text toolbar ----------
const SPECIAL = ["µ", "°", "×", "±", "→", "Δ", "α", "β", "γ", "κ", "λ", "≥", "≤"];

function wrapSel(marker: string): void {
  const ta = lastRt;
  if (!ta) return;
  const a = ta.selectionStart ?? 0, b = ta.selectionEnd ?? 0;
  ta.value = ta.value.slice(0, a) + marker + ta.value.slice(a, b) + marker + ta.value.slice(b);
  ta.setSelectionRange(a + marker.length, b + marker.length);
  ta.dispatchEvent(new Event("input"));
  ta.focus();
}
function insertText(s: string): void {
  const ta = lastRt;
  if (!ta) return;
  const a = ta.selectionStart ?? 0, b = ta.selectionEnd ?? 0;
  ta.value = ta.value.slice(0, a) + s + ta.value.slice(b);
  ta.setSelectionRange(a + s.length, a + s.length);
  ta.dispatchEvent(new Event("input"));
  ta.focus();
}
function tbBtn(label: string, title: string, fn: () => void, cls = ""): HTMLElement {
  const b = h("button", { type: "button", class: "tb " + cls, title }, label);
  b.addEventListener("mousedown", (e) => e.preventDefault()); // keep text selection/focus
  b.addEventListener("click", fn);
  return b;
}
function buildToolbar(): HTMLElement {
  return h(
    "div",
    { class: "toolbar" },
    tbBtn("B", "**bold**", () => wrapSel("**"), "b"),
    tbBtn("I", "*italic*", () => wrapSel("*"), "i"),
    tbBtn("x²", "^superscript^", () => wrapSel("^")),
    tbBtn("x₂", "~subscript~", () => wrapSel("~")),
    h("span", { class: "sep" }),
    ...SPECIAL.map((c) => tbBtn(c, c, () => insertText(c)))
  );
}
function trackRt(el: HTMLInputElement | HTMLTextAreaElement): void {
  el.classList.add("rt");
  el.addEventListener("focus", () => { lastRt = el; });
}

// ---------- event list ----------
const PRESETS = ["#ffffff", "#dbeafe", "#dcfce7", "#fef3c7", "#fee2e2", "#ede9fe", "#e5e7eb"];

function buildRow(ev: EventItem, idx: number): HTMLElement {
  const row = h("div", { class: "ev", "data-id": ev.id });
  row.addEventListener("pointerdown", () => { if (selectedId !== ev.id) select(ev.id, false); });

  const tIn = h("input", { type: "number", step: 0.5, value: String(ev.t) });
  tIn.addEventListener("input", () => {
    const v = parseFloat(tIn.value);
    if (!isFinite(v)) return;
    ev.t = v;
    if (dIn) dIn.value = toIso(dateOf(project, v));
    edit("t:" + ev.id);
  });
  const dIn: HTMLInputElement | null = supportsDate(project) ? h("input", { type: "date", value: toIso(dateOf(project, ev.t)) }) : null;
  dIn?.addEventListener("change", () => {
    const v = tOfDate(project, dIn.value);
    if (v === null) return;
    ev.t = v;
    tIn.value = String(v);
    edit();
  });
  const sideSel = h("select", {},
    h("option", { value: "auto", selected: ev.side === "auto" }, t("sideAuto")),
    h("option", { value: "above", selected: ev.side === "above" }, t("sideAbove")),
    h("option", { value: "below", selected: ev.side === "below" }, t("sideBelow")));
  sideSel.addEventListener("change", () => { ev.side = sideSel.value as EventItem["side"]; edit(); });
  const catSel = categorySelect(ev.category, (v) => { ev.category = v; edit(); });

  const dup = h("button", { type: "button", class: "ico", title: t("duplicate") }, "⧉");
  dup.addEventListener("click", () => {
    const c: EventItem = JSON.parse(JSON.stringify(ev));
    c.id = newEvent(0).id;
    project.events.splice(project.events.indexOf(ev) + 1, 0, c);
    selectedId = c.id;
    edit();
    renderList();
  });
  const del = h("button", { type: "button", class: "ico danger", title: t("delete") }, "✕");
  del.addEventListener("click", () => {
    project.events = project.events.filter((e) => e !== ev);
    if (selectedId === ev.id) selectedId = null;
    edit();
    renderList();
  });

  const ta = h("textarea", { rows: 2, value: ev.text, spellcheck: "false", class: "ta-text" });
  ta.addEventListener("input", () => { ev.text = ta.value; edit("x:" + ev.id); });
  trackRt(ta);
  const noteTa = h("textarea", { rows: 1, value: ev.note, spellcheck: "false", class: "ta-note", placeholder: t("note") });
  noteTa.addEventListener("input", () => { ev.note = noteTa.value; edit("n:" + ev.id); });
  trackRt(noteTa);
  const resetPos = h("button", { type: "button", class: "link" }, t("resetPos"));
  resetPos.addEventListener("click", () => { ev.dx = ev.dy = ev.ldx = ev.ldy = ev.ndx = ev.ndy = ev.tdx = ev.tdy = ev.adx = ev.ady = 0; edit(); });

  // style details
  const lab = h("input", { type: "text", value: ev.labelOverride, placeholder: "Day 2" });
  lab.addEventListener("input", () => { ev.labelOverride = lab.value; edit("l:" + ev.id); });
  trackRt(lab);

  const fill = clrPick(ev.style.fill ?? project.settings.box.fill, "#ffffff", (v) => { ev.style.fill = v; edit("f:" + ev.id); });
  const stroke = clrPick(ev.style.stroke ?? project.settings.box.stroke, "#1e293b", (v) => { ev.style.stroke = v; edit("c:" + ev.id); });
  const sw = h("input", { type: "number", step: 0.25, min: 0, value: String(ev.style.strokeWidthPt ?? project.settings.box.strokeWidthPt) });
  sw.addEventListener("input", () => {
    const v = parseFloat(sw.value);
    if (isFinite(v)) { ev.style.strokeWidthPt = v; edit("w:" + ev.id); }
  });
  const dashed = h("input", { type: "checkbox", checked: ev.style.dashed ?? project.settings.box.dashed });
  dashed.addEventListener("change", () => { ev.style.dashed = dashed.checked; edit(); });
  const shape = h("select", {}, ...(["rounded", "rect", "none"] as const).map((v) =>
    h("option", { value: v, selected: (ev.style.shape ?? project.settings.box.shape) === v }, t(v === "rounded" ? "shapeRounded" : v === "rect" ? "shapeRect" : "shapeNone"))));
  shape.addEventListener("change", () => { ev.style.shape = shape.value as "rounded"; edit(); });
  const swatches = h("div", { class: "swatches" }, ...PRESETS.map((c) => {
    const b = h("button", { type: "button", class: "sw", title: c, style: `background:${c}` });
    b.addEventListener("click", () => { ev.style.fill = c; edit(); renderList(); });
    return b;
  }));
  const reset = h("button", { type: "button", class: "link" }, t("resetStyle"));
  reset.addEventListener("click", () => { ev.style = {}; edit(); renderList(); });

  row.append(
    h("div", { class: "ev-head" },
      h("span", { class: "idx" }, String(idx + 1)),
      field(t("time"), tIn),
      dIn ? field(t("date"), dIn) : null,
      field(t("side"), sideSel),
      field(t("category"), catSel),
      h("span", { class: "grow" }),
      dup, del),
    ta,
    noteTa,
    h("details", { class: "more" },
      h("summary", {}, t("style")),
      h("div", { class: "grid" },
        field(t("labelOverride"), lab),
        field(t("fill"), fill), swatches,
        field(t("stroke"), stroke),
        field(t("strokeWidth"), sw),
        h("label", { class: "fld chk" }, dashed, h("span", {}, t("dashed"))),
        field(t("shape"), shape),
        reset, resetPos))
  );
  return row;
}

function toIso(d: Date | null): string {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function renderList(): void {
  listEl.replaceChildren(...project.events.map((e, i) => buildRow(e, i)));
  markSelected();
}


// ---------- categories / periods / breaks ----------
function categorySelect(current: string, onChange: (v: string) => void): HTMLSelectElement {
  const sel = h("select", { class: "cat" },
    h("option", { value: "" }, t("noCategory")),
    ...project.categories.map((c) => h("option", { value: c.id, selected: c.id === current }, c.name || "…")));
  sel.addEventListener("change", () => onChange(sel.value));
  return sel;
}

function numField(obj: object, key: string, label: string, keyPrefix: string, step = 0.5): HTMLElement {
  const rec = obj as Record<string, number>;
  const i = h("input", { type: "number", step, value: String(rec[key]) });
  i.addEventListener("input", () => {
    const v = parseFloat(i.value);
    if (!isFinite(v)) return;
    rec[key] = v;
    edit(keyPrefix + key);
  });
  return field(label, i);
}

function section(title: string, hint: string | null, addLabel: string, fill: (box: HTMLElement) => void, onAdd: () => void): HTMLElement {
  const box = h("div", { class: "sublist" });
  const render = () => fill(box);
  render();
  (box as unknown as { _render: () => void })._render = render;
  const add = btn(addLabel, () => { onAdd(); render(); });
  return h("details", { class: "grp", open: true }, h("summary", {}, title), hint ? h("p", { class: "hint" }, hint) : null, box, h("div", { class: "row-actions" }, add));
}

function buildPeriods(): HTMLElement {
  return section(t("periods"), null, t("addPeriod"),
    (box) => box.replaceChildren(...project.periods.map((q) => {
      const text = h("input", { type: "text", value: q.text, placeholder: "薬剤処理" });
      text.addEventListener("input", () => { q.text = text.value; edit("pt:" + q.id); });
      trackRt(text);
      const cat = categorySelect(q.category, (v) => { q.category = v; edit(); });
      const fill = clrPick(q.fill || project.settings.period.fill, "#fde68a", (v) => { q.fill = v; edit("pf:" + q.id); });
      const del = h("button", { type: "button", class: "ico danger", title: t("delete") }, "✕");
      del.addEventListener("click", () => { project.periods = project.periods.filter((x) => x !== q); edit(); box.replaceChildren(...[]); (box as unknown as { _render: () => void })._render(); });
      return h("div", { class: "ev" },
        h("div", { class: "ev-head" },
          numField(q, "start", t("periodStart"), "ps:" + q.id), numField(q, "end", t("periodEnd"), "pe:" + q.id),
          field(t("category"), cat), field(t("fill"), fill), h("span", { class: "grow" }), del),
        field(t("periodText"), text));
    })),
    () => {
      const maxT = project.events.length ? Math.max(...project.events.map((e) => e.t)) : 1;
      project.periods.push(newPeriod(0, Math.max(1, Math.floor(maxT / 2))));
      edit();
    });
}

function buildCategories(): HTMLElement {
  return section(t("categories"), null, t("addCategory"),
    (box) => box.replaceChildren(...project.categories.map((c) => {
      const name = h("input", { type: "text", value: c.name });
      name.addEventListener("input", () => {
        c.name = name.value;
        document.querySelectorAll(`select.cat option[value="${c.id}"]`).forEach((o) => { o.textContent = c.name || "…"; });
        edit("cn:" + c.id);
      });
      trackRt(name);
      const fill = clrPick(c.fill, "#dbeafe", (v) => { c.fill = v; edit("cf:" + c.id); });
      const stroke = clrPick(c.stroke, "#1d4ed8", (v) => { c.stroke = v; edit("cs:" + c.id); });
      const del = h("button", { type: "button", class: "ico danger", title: t("delete") }, "✕");
      del.addEventListener("click", () => {
        project.categories = project.categories.filter((x) => x !== c);
        for (const e of project.events) if (e.category === c.id) e.category = "";
        for (const q of project.periods) if (q.category === c.id) q.category = "";
        edit();
        renderAll();
      });
      return h("div", { class: "ev" }, h("div", { class: "ev-head" }, field(t("catName"), name), field(t("fill"), fill), field(t("stroke"), stroke), del));
    })),
    () => {
      project.categories.push(newCategory(t("category") + " " + (project.categories.length + 1), project.categories.length));
      edit();
      renderAll();
    });
}

function buildBreaks(): HTMLElement {
  return section(t("breaks"), t("breakHint"), t("addBreak"),
    (box) => box.replaceChildren(...project.breaks.map((b) => {
      const del = h("button", { type: "button", class: "ico danger", title: t("delete") }, "✕");
      del.addEventListener("click", () => { project.breaks = project.breaks.filter((x) => x !== b); edit(); (box as unknown as { _render: () => void })._render(); });
      return h("div", { class: "ev" }, h("div", { class: "ev-head" }, numField(b, "from", t("breakFrom"), "bf:" + b.id), numField(b, "to", t("breakTo"), "bt:" + b.id), h("span", { class: "grow" }), del));
    })),
    () => {
      const maxT = project.events.length ? Math.max(...project.events.map((e) => e.t)) : 10;
      project.breaks.push(newBreak(Math.max(1, Math.floor(maxT / 3)), Math.max(3, Math.floor((maxT * 2) / 3))));
      edit();
    });
}

// ---------- TSV / templates ----------
function buildTsvDialog(): HTMLDialogElement {
  const ta = h("textarea", { rows: 10, placeholder: "0\t細胞播種\t播種\n2\t培地交換\n1-3\t薬剤処理\t処理\n5\t細胞回収\\nPCR\t回収", spellcheck: "false" });
  const msg = h("p", { class: "hint" });
  const apply = (replace: boolean) => {
    const r = parseTsv(ta.value, project);
    if (!r.events.length && !r.periods.length) { msg.textContent = `0 (skipped ${r.skipped})`; return; }
    project.categories.push(...r.categories);
    if (replace) { project.events = r.events; project.periods = r.periods; }
    else { project.events.push(...r.events); project.periods.push(...r.periods); }
    selectedId = null;
    edit();
    tsvDialog.close();
    ta.value = "";
    msg.textContent = "";
    renderAll();
  };
  const dlg = h("dialog", { class: "dlg" },
    h("h2", {}, t("tsvTitle")), h("p", { class: "hint" }, t("tsvHelp")), ta, msg,
    h("div", { class: "row-actions" },
      btn(t("tsvAppend"), () => apply(false), "primary"), btn(t("tsvReplace"), () => apply(true)), btn(t("tsvCancel"), () => dlg.close())));
  return dlg;
}
function openTsv(): void { tsvDialog.showModal(); }

// ---------- file library (saved in this browser) ----------
function curEntry() {
  const id = getCurrent();
  return id ? listLib().find((e) => e.id === id) ?? null : null;
}
function updateCurName(): void {
  if (curFileEl) curFileEl.textContent = curEntry()?.name ?? "";
}
function saveToLib(asNew: boolean, name?: string): boolean {
  const cur = asNew ? null : curEntry();
  const nm = name ?? cur?.name ?? "";
  if (!nm.trim()) return false;
  const e = saveLib(nm, JSON.stringify(project), cur?.id ?? null);
  if (!e) { alert(t("libFail")); return false; }
  setCurrent(e.id);
  updateCurName();
  return true;
}
function buildLibDialog(): HTMLDialogElement {
  const body = h("div", { class: "libbody" });
  const nameIn = h("input", { type: "text", placeholder: t("libName") });
  const render = () => {
    const cur = curEntry();
    if (document.activeElement !== nameIn) nameIn.value = cur?.name ?? nameIn.value;
    const list = listLib();
    body.replaceChildren(...(list.length ? list.map((e) => {
      const open = btn(t("libOpen"), () => {
        let p;
        try { p = parseProject(e.json); } catch { alert(t("libFail")); return; }
        project = p;
        selectedId = null;
        setCurrent(e.id);
        hist.commit(project);
        renderAll();
        libDialog.close();
      }, "primary");
      const ren = btn(t("libRename"), () => {
        const n = prompt(t("libName"), e.name);
        if (n && n.trim()) { renameLib(e.id, n); updateCurName(); render(); }
      });
      const del = btn(t("delete"), () => {
        if (!confirm(t("libConfirmDelete") + " " + e.name)) return;
        deleteLib(e.id);
        if (getCurrent() === e.id) setCurrent(null);
        updateCurName();
        render();
      }, "danger");
      return h("div", { class: "libitem" + (cur?.id === e.id ? " cur" : "") },
        h("span", { class: "n" }, e.name), h("span", { class: "d" }, new Date(e.updated).toLocaleString()), open, ren, del);
    }) : [h("p", { class: "hint" }, t("libEmpty"))]));
  };
  const saveNew = btn(t("libSaveNew"), () => { if (saveToLib(true, nameIn.value)) render(); });
  const overwrite = btn(t("libOverwrite"), () => { if (saveToLib(false, nameIn.value)) render(); }, "primary");
  const dlg = h("dialog", { class: "dlg" },
    h("h2", {}, t("libTitle")), h("p", { class: "hint" }, t("libHelp")),
    h("div", { class: "row-actions" }, nameIn, overwrite, saveNew),
    body,
    h("div", { class: "row-actions" }, btn(t("tsvCancel"), () => dlg.close())));
  (dlg as unknown as { _render: () => void })._render = render;
  return dlg;
}
function openLib(): void {
  (libDialog as unknown as { _render: () => void })._render();
  libDialog.showModal();
}

// ---------- PDF (vector, via the browser's print-to-PDF) ----------
async function exportPdf(): Promise<void> {
  const font = outlineFont ?? (await loadBundledFont());
  if (font) {
    outlineFont = font;
    setMeasurer((text, px) => font.advance(text, px));
  }
  let svg: string;
  try { svg = buildSvg(project, font ? { font } : {}); } finally { useCanvasMeasurer(); }
  const wm = /width="([\d.]+)mm"/.exec(svg)?.[1], hm = /height="([\d.]+)mm"/.exec(svg)?.[1];
  const page = wm && hm ? `${wm}mm ${hm}mm` : "auto";
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${(curEntry()?.name ?? "timeline").replace(/[<>&]/g, "")}</title><style>@page{size:${page};margin:0}html,body{margin:0;padding:0;background:#fff}svg{display:block}</style></head><body>${svg}</body></html>`;
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  f.srcdoc = doc;
  f.onload = () => {
    const w = f.contentWindow;
    if (!w) return;
    w.addEventListener("afterprint", () => setTimeout(() => f.remove(), 500));
    w.focus();
    w.print();
  };
  document.body.append(f);
}

function buildTemplateSelect(): HTMLElement {
  const sel = h("select", { class: "tplsel" }, h("option", { value: "" }, t("templatePick")),
    ...templates(getLang()).map((x) => h("option", { value: x.id }, x.name)));
  sel.addEventListener("change", () => {
    const tpl = templates(getLang()).find((x) => x.id === sel.value);
    sel.value = "";
    if (!tpl || !confirm(t("confirmTemplate"))) return;
    project = tpl.build();
    selectedId = null;
    hist.commit(project);
    renderAll();
  });
  return sel;
}

// ---------- outlined export ----------
function buildFontGroup(): HTMLElement {
  fontStatusEl = h("p", { class: "hint" }, outlineFont ? t("fontLoaded") + outlineFont.name : t("fontBundled"));
  const file = h("input", { type: "file", accept: ".ttf,.otf,.woff", class: "hidden" });
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    file.value = "";
    if (!f) return;
    try {
      outlineFont = await parseFont(await f.arrayBuffer(), f.name);
      fontStatusEl!.textContent = t("fontLoaded") + f.name;
    } catch {
      alert(t("fontFail"));
    }
  });
  return h("details", { class: "grp" }, h("summary", {}, t("fontOutline")),
    h("div", { class: "grid" }, fontStatusEl, h("p", { class: "hint" }, t("outlineHint")), btn(t("fontLoad"), () => file.click()), file));
}

async function exportOutline(): Promise<void> {
  const font = outlineFont ?? (await loadBundledFont());
  if (!font) { alert(t("fontMissing")); return; }
  outlineFont = font;
  if (fontStatusEl) fontStatusEl.textContent = t("fontLoaded") + font.name;
  setMeasurer((text, px) => font.advance(text, px)); // lay out with the same metrics the outlines use
  try {
    download("timeline-outlined.svg", "image/svg+xml", buildSvg(project, { font }));
  } finally {
    useCanvasMeasurer();
  }
}


// ---------- free texts ----------
function syncLists(): void {
  const ax = document.querySelector<HTMLInputElement>('input[data-path="axis.extend"]');
  if (ax && ax !== document.activeElement) ax.value = String(project.settings.axis.extend);
  const al = document.querySelector<HTMLInputElement>('input[data-path="period.arrowLen"]');
  if (al && al !== document.activeElement) al.value = String(project.settings.period.arrowLen);
  for (const row of listEl.querySelectorAll<HTMLElement>(".ev")) {
    const ev = project.events.find((e) => e.id === row.dataset.id);
    if (!ev) continue;
    const a = row.querySelector<HTMLTextAreaElement>("textarea.ta-text");
    const b = row.querySelector<HTMLTextAreaElement>("textarea.ta-note");
    if (a && a.value !== ev.text) a.value = ev.text;
    if (b && b.value !== ev.note) b.value = ev.note;
  }
}

function buildTexts(): HTMLElement {
  const el = section(t("texts"), t("textHint"), t("addText"),
    (box) => box.replaceChildren(...project.texts.map((f) => {
      const ta = h("textarea", { rows: 1, value: f.text, spellcheck: "false", placeholder: t("textPlaceholder") });
      ta.addEventListener("input", () => { f.text = ta.value; edit("ft:" + f.id); });
      trackRt(ta);
      const del = h("button", { type: "button", class: "ico danger", title: t("delete") }, "✕");
      del.addEventListener("click", () => { project.texts = project.texts.filter((x) => x !== f); if (selectedFree === f.id) selectedFree = null; edit(); textsRebuild(); });
      return h("div", { class: "ev" }, h("div", { class: "ev-head" }, h("span", { class: "grow" }), del), ta);
    })),
    () => {
      const sc = lastScene ?? layout(project);
      const f = newText(Math.round(sc.W / 2), Math.round(sc.H - sc.freeSpace / 2 - sc.axisY - sc.lh / 2), t("textPlaceholder"));
      project.texts.push(f);
      selectedFree = f.id;
      edit();
    });
  textsRebuild = () => (el.querySelector(".sublist") as unknown as { _render: () => void })._render();
  return el;
}

// ---------- shell ----------
function btn(label: string, fn: () => void, cls = ""): HTMLButtonElement {
  const b = h("button", { type: "button", class: cls }, label);
  b.addEventListener("click", fn);
  return b;
}

function renderAll(): void {
  const root = document.getElementById("app")!;
  document.documentElement.lang = getLang();
  document.title = `${t("appTitle")} – ${t("tagline")}`;

  undoBtn = btn("↶ " + t("undo"), () => restore(hist.undo()));
  redoBtn = btn("↷ " + t("redo"), () => restore(hist.redo()));
  const fileIn = h("input", { type: "file", accept: ".json,application/json", class: "hidden" });
  fileIn.addEventListener("change", async () => {
    const f = fileIn.files?.[0];
    fileIn.value = "";
    if (!f) return;
    try {
      project = parseProject(await f.text());
      selectedId = null;
      hist.commit(project);
      renderAll();
    } catch {
      alert(t("loadError"));
    }
  });
  const langSel = h("select", {},
    h("option", { value: "ja", selected: getLang() === "ja" }, "日本語"),
    h("option", { value: "en", selected: getLang() === "en" }, "English"));
  langSel.addEventListener("change", () => { setLang(langSel.value as Lang); saveLang(getLang()); renderAll(); });

  svgHost = h("div", { class: "svghost" });
  previewEl = h("div", { id: "preview" }, svgHost);
  interact = setupInteractions({
    host: previewEl,
    project: () => project,
    scene: () => lastScene ?? layout(project),
    edit,
    refresh,
    commit: (key) => hist.commit(project, key),
    selectEvent: (id) => { selectedId = id; markSelected(); if (id) listEl.querySelector(`.ev[data-id="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); },
    selectFree: (id) => { selectedFree = id; markSelected(); },
    syncLists,
    rebuildTexts: () => textsRebuild(),
  });
  warnEl = h("div", { class: "warn" });
  listEl = h("div", { class: "list" });
  tsvDialog = buildTsvDialog();
  libDialog = buildLibDialog();
  curFileEl = h("span", { class: "curfile" });

  const addBtn = btn(t("addEvent"), () => {
    const maxT = project.events.length ? Math.max(...project.events.map((e) => e.t)) : -1;
    const ev = newEvent(Math.floor(maxT) + 1);
    project.events.push(ev);
    selectedId = ev.id;
    edit();
    renderList();
    select(ev.id, true);
  }, "primary");
  const sortBtn = btn(t("sortEvents"), () => {
    project.events = project.events.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i).map((o) => o.e);
    edit();
    renderList();
  });

  root.replaceChildren(
    h("header", { class: "top" },
      h("div", { class: "brand" }, h("b", {}, t("appTitle")), h("span", {}, t("tagline"))),
      h("div", { class: "actions" },
        undoBtn, redoBtn,
        h("span", { class: "sep" }),
        btn(t("libOpenBtn"), openLib), curFileEl,
        btn(t("saveJson"), () => download("timeline.json", "application/json", JSON.stringify(project, null, 2))),
        btn(t("loadJson"), () => fileIn.click()), fileIn,
        btn(t("reset"), () => {
          if (!confirm(t("confirmReset"))) return;
          project = sampleProject();
          selectedId = null;
          hist.commit(project);
          renderAll();
        }),
        h("span", { class: "sep" }),
        btn(t("exportText"), () => download("timeline.svg", "image/svg+xml", buildSvg(project)), "primary"),
        btn(t("exportOutline"), () => void exportOutline(), "primary"),
        btn(t("exportPdf"), () => void exportPdf(), "primary"),
        h("label", { class: "lang" }, t("lang") + " ", langSel))),
    h("main", {},
      h("aside", { class: "panel" },
        h("div", { class: "row-actions" }, buildTemplateSelect(), btn(t("tsvOpen"), openTsv)),
        h("h2", {}, t("events")),
        buildToolbar(),
        h("p", { class: "hint" }, t("markupHelp")),
        listEl,
        h("div", { class: "row-actions" }, addBtn, sortBtn),
        buildTexts(),
        buildPeriods(),
        buildCategories(),
        buildBreaks(),
        buildSettings(),
        tsvDialog, libDialog),
      h("section", { class: "stage" },
        previewEl, warnEl,
        h("p", { class: "hint" }, t("dragHint")),
        h("p", { class: "hint" }, "🔒 " + t("privacy"))))
  );
  renderList();
  refresh();
}

setLang(detectLang());
renderAll();

window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (!saveToLib(false)) openLib();
    return;
  }
  const tag = (e.target as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if ((e.key === "Delete" || e.key === "Backspace") && selectedFree) {
    e.preventDefault();
    project.texts = project.texts.filter((x) => x.id !== selectedFree);
    selectedFree = null;
    edit();
    textsRebuild();
    return;
  }
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z" && e.key.toLowerCase() !== "y") return;
  e.preventDefault();
  restore(e.key.toLowerCase() === "y" || e.shiftKey ? hist.redo() : hist.undo());
});
