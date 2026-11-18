import type { EventItem, Project } from "./model.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtNum(t: number): string {
  return String(Math.round(t * 100) / 100);
}

export function unitLabel(p: Project, t: number): string {
  const a = p.settings.axis;
  const n = fmtNum(t);
  switch (a.unit) {
    case "Hour": return `${n} h`;
    case "custom": return a.customUnit ? `${a.customUnit} ${n}` : n;
    default: return `${a.unit} ${n}`;
  }
}

const UNIT_DAYS: Record<string, number> = { Day: 1, Week: 7, Hour: 1 / 24 };

export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export function supportsDate(p: Project): boolean {
  return p.settings.axis.unit in UNIT_DAYS && parseDate(p.settings.date.start) !== null;
}

export function dateOf(p: Project, t: number): Date | null {
  const start = parseDate(p.settings.date.start);
  const k = UNIT_DAYS[p.settings.axis.unit];
  if (!start || k === undefined) return null;
  const d = new Date(start.getTime());
  d.setDate(d.getDate() + Math.floor(t * k));
  return d;
}

export function tOfDate(p: Project, iso: string): number | null {
  const start = parseDate(p.settings.date.start);
  const d = parseDate(iso);
  const k = UNIT_DAYS[p.settings.axis.unit];
  if (!start || !d || k === undefined) return null;
  const days = Math.round((d.getTime() - start.getTime()) / 86400000);
  return Math.round((days / k) * 100) / 100;
}

export function fmtDate(d: Date, format: string): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  switch (format) {
    case "YYYY/MM/DD": return `${d.getFullYear()}/${mm}/${dd}`;
    case "D MMM": return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    default: return `${mm}/${dd}`;
  }
}

/** Lines of the time label shown on the axis for an event. */
export function labelLines(p: Project, ev: EventItem): string[] {
  if (ev.labelOverride.trim()) return ev.labelOverride.split("\n");
  const u = unitLabel(p, ev.t);
  const dm = p.settings.date.mode;
  if (dm === "none") return [u];
  const d = dateOf(p, ev.t);
  if (!d) return [u];
  const ds = fmtDate(d, p.settings.date.format);
  if (dm === "date") return [ds];
  return p.settings.date.layout === "twoline" ? [u, ds] : [`${u} (${ds})`];
}
