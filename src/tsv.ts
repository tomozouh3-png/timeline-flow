import { newCategory, newEvent, newPeriod } from "./model.ts";
import type { Category, EventItem, Period, Project } from "./model.ts";

export interface TsvResult {
  events: EventItem[];
  periods: Period[];
  categories: Category[]; // newly created categories only
  skipped: number;
}

const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
const SINGLE = new RegExp(String.raw`^\s*(?:[A-Za-z]+\s*)?${NUM}\s*(?:[A-Za-z]+)?\s*$`);
const RANGE = new RegExp(String.raw`^\s*(?:[A-Za-z]+\s*)?${NUM}\s*(?:[A-Za-z]+)?\s*[~\-–—]\s*${NUM}\s*(?:[A-Za-z]+)?\s*$`);

/**
 * Columns: time | text | category (optional).
 * A time like "1-3" or "1~3" creates a period bar instead of an event.
 * "\n" inside the text cell becomes a line break. A header row is skipped.
 */
export function parseTsv(src: string, project: Project): TsvResult {
  const events: EventItem[] = [];
  const periods: Period[] = [];
  const created: Category[] = [];
  let skipped = 0;
  const catId = (name: string): string => {
    const nm = name.trim();
    if (!nm) return "";
    const all = [...project.categories, ...created];
    const hit = all.find((c) => c.name.toLowerCase() === nm.toLowerCase());
    if (hit) return hit.id;
    const c = newCategory(nm, all.length);
    created.push(c);
    return c.id;
  };
  for (const line of src.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = (line.includes("\t") ? line.split("\t") : line.split(",")).map((c) => c.trim());
    const text = (cells[1] ?? "").replace(/\\n/g, "\n");
    const rng = RANGE.exec(cells[0]);
    const one = rng ? null : SINGLE.exec(cells[0]);
    if (!rng && !one) {
      skipped++; // header or unparseable row (must not create categories)
      continue;
    }
    const cat = catId(cells[2] ?? "");
    if (rng) {
      const pe = newPeriod(parseFloat(rng[1]), parseFloat(rng[2]), text);
      pe.category = cat;
      periods.push(pe);
      continue;
    }
    const ev = newEvent(parseFloat(one![1]), text);
    ev.category = cat;
    events.push(ev);
  }
  return { events, periods, categories: created, skipped };
}
