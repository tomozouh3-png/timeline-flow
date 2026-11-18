export type Side = "auto" | "above" | "below";

export interface BoxStyle {
  fill: string;
  stroke: string;
  strokeWidthPt: number;
  dashed: boolean;
  radius: number; // px
  shape: "rounded" | "rect" | "none";
}

export interface EventItem {
  id: string;
  t: number;
  text: string;
  labelOverride: string;
  side: Side;
  category: string; // Category id or ""
  style: Partial<BoxStyle>;
}

export interface Category {
  id: string;
  name: string;
  fill: string;
  stroke: string;
}

export interface Period {
  id: string;
  start: number;
  end: number;
  text: string;
  category: string;
  fill: string; // "" = use category / default
}

export interface AxisBreak {
  id: string;
  from: number;
  to: number;
}

export interface Settings {
  widthMm: number;
  fontFamily: string;
  fontSizePt: number;
  labelFontSizePt: number;
  background: "transparent" | "white";
  axis: {
    unit: "Day" | "Hour" | "Week" | "Month" | "custom";
    customUnit: string;
    mode: "proportional" | "equal";
    arrow: boolean;
    widthPt: number;
    color: string;
    ticks: "none" | "events" | "unit";
  };
  date: {
    start: string; // YYYY-MM-DD or ""
    mode: "none" | "date" | "both";
    format: "MM/DD" | "YYYY/MM/DD" | "D MMM";
    layout: "inline" | "twoline";
  };
  connector: {
    style: "toAxis" | "toBox" | "none";
    length: number;
    widthPt: number;
  };
  box: BoxStyle & {
    uniformHeight: boolean;
    minWidth: number;
    minHeight: number;
    padX: number;
    padY: number;
    align: "center" | "left";
    valign: "top" | "middle";
  };
  alternate: boolean;
  period: {
    position: "bottom" | "top";
    height: number; // px
    fill: string;
    stroke: string;
    endShape: "square" | "round" | "arrow";
  };
  legend: boolean;
}

export interface Project {
  version: 1;
  settings: Settings;
  events: EventItem[];
  periods: Period[];
  categories: Category[];
  breaks: AxisBreak[];
}

export function defaultSettings(): Settings {
  return {
    widthMm: 180,
    fontFamily: 'Arial, Helvetica, "Hiragino Sans", "Yu Gothic", sans-serif',
    fontSizePt: 10,
    labelFontSizePt: 10,
    background: "transparent",
    axis: {
      unit: "Day",
      customUnit: "",
      mode: "proportional",
      arrow: true,
      widthPt: 1.25,
      color: "#111111",
      ticks: "none",
    },
    date: { start: "", mode: "none", format: "MM/DD", layout: "inline" },
    connector: { style: "toAxis", length: 36, widthPt: 1 },
    box: {
      fill: "#ffffff",
      stroke: "#1e293b",
      strokeWidthPt: 1,
      dashed: false,
      radius: 14,
      shape: "rounded",
      uniformHeight: true,
      minWidth: 70,
      minHeight: 60,
      padX: 12,
      padY: 10,
      align: "center",
      valign: "top",
    },
    alternate: true,
    period: { position: "bottom", height: 22, fill: "#fde68a", stroke: "#92400e", endShape: "square" },
    legend: true,
  };
}

let counter = 0;
export function uid(): string {
  counter++;
  return "e" + Date.now().toString(36) + counter.toString(36) + Math.random().toString(36).slice(2, 5);
}

export function newEvent(t: number, text = ""): EventItem {
  return { id: uid(), t, text, labelOverride: "", side: "auto", category: "", style: {} };
}

export const CATEGORY_COLORS: [string, string][] = [
  ["#dbeafe", "#1d4ed8"],
  ["#fef3c7", "#b45309"],
  ["#dcfce7", "#15803d"],
  ["#fee2e2", "#b91c1c"],
  ["#ede9fe", "#6d28d9"],
  ["#e5e7eb", "#374151"],
];

export function newCategory(name: string, index: number): Category {
  const [fill, stroke] = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  return { id: uid(), name, fill, stroke };
}

export function newPeriod(start: number, end: number, text = ""): Period {
  return { id: uid(), start, end, text, category: "", fill: "" };
}

export function newBreak(from: number, to: number): AxisBreak {
  return { id: uid(), from, to };
}

export function sampleProject(): Project {
  return {
    version: 1,
    settings: defaultSettings(),
    events: [newEvent(0, "細胞播種"), newEvent(2, "培地交換"), newEvent(5, "細胞回収\nPCR")],
    periods: [],
    categories: [],
    breaks: [],
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Merge loaded data over defaults so older/partial files still load. */
export function deepMerge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined ? base : (over as T)) ?? base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const k of Object.keys(over)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = isObj(b) ? deepMerge(b, over[k]) : over[k];
  }
  return out as T;
}

export function parseProject(json: string): Project {
  const raw = JSON.parse(json);
  if (!isObj(raw) || !Array.isArray(raw.events)) throw new Error("invalid project");
  const events: EventItem[] = raw.events.map((e: unknown) => {
    const o = isObj(e) ? e : {};
    return {
      id: typeof o.id === "string" ? o.id : uid(),
      t: typeof o.t === "number" && isFinite(o.t) ? o.t : 0,
      text: typeof o.text === "string" ? o.text : "",
      labelOverride: typeof o.labelOverride === "string" ? o.labelOverride : "",
      side: o.side === "above" || o.side === "below" ? o.side : "auto",
      category: typeof o.category === "string" ? o.category : "",
      style: isObj(o.style) ? (o.style as Partial<BoxStyle>) : {},
    };
  });
  const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter(isObj) : []);
  const n = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? v : d);
  const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
  const periods: Period[] = arr(raw.periods).map((o) => ({
    id: str(o.id) || uid(), start: n(o.start, 0), end: n(o.end, 1), text: str(o.text), category: str(o.category), fill: str(o.fill),
  }));
  const categories: Category[] = arr(raw.categories).map((o, i) => ({
    id: str(o.id) || uid(), name: str(o.name, "category " + (i + 1)), fill: str(o.fill, "#dbeafe"), stroke: str(o.stroke, "#1d4ed8"),
  }));
  const breaks: AxisBreak[] = arr(raw.breaks).map((o) => ({ id: str(o.id) || uid(), from: n(o.from, 0), to: n(o.to, 1) }));
  return { version: 1, settings: deepMerge(defaultSettings(), raw.settings), events, periods, categories, breaks };
}
