/** Named projects kept in the browser (localStorage), so a figure can be saved per file and reopened any time. */
export interface LibEntry {
  id: string;
  name: string;
  updated: number; // epoch ms
  json: string; // serialized Project
}

const LIB_KEY = "timelineflow:library:v1";
const CUR_KEY = "timelineflow:current:v1";

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function listLib(kv: KV = localStorage): LibEntry[] {
  try {
    const a = JSON.parse(kv.getItem(LIB_KEY) || "[]");
    return Array.isArray(a)
      ? a.filter((e) => e && typeof e.id === "string" && typeof e.json === "string").sort((x, y) => y.updated - x.updated)
      : [];
  } catch {
    return [];
  }
}

function write(list: LibEntry[], kv: KV): boolean {
  try { kv.setItem(LIB_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

/** Save under `id` (overwrite) or as a new entry. Returns the entry, or null if storage failed. */
export function saveLib(name: string, json: string, id: string | null, kv: KV = localStorage, now = Date.now()): LibEntry | null {
  const list = listLib(kv);
  const clean = name.trim() || "untitled";
  let e = id ? list.find((x) => x.id === id) : undefined;
  if (e) { e.name = clean; e.json = json; e.updated = now; }
  else {
    e = { id: "f" + now.toString(36) + Math.random().toString(36).slice(2, 6), name: clean, updated: now, json };
    list.push(e);
  }
  return write(list, kv) ? e : null;
}

export function renameLib(id: string, name: string, kv: KV = localStorage): void {
  const list = listLib(kv);
  const e = list.find((x) => x.id === id);
  if (e && name.trim()) { e.name = name.trim(); write(list, kv); }
}

export function deleteLib(id: string, kv: KV = localStorage): void {
  write(listLib(kv).filter((x) => x.id !== id), kv);
}

export function getCurrent(kv: KV = localStorage): string | null {
  try { return kv.getItem(CUR_KEY); } catch { return null; }
}
export function setCurrent(id: string | null, kv: KV = localStorage): void {
  try { kv.setItem(CUR_KEY, id ?? ""); } catch { /* ignore */ }
}
