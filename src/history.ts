import type { Project } from "./model.ts";

/** Snapshot-based undo/redo. Rapid edits with the same key are coalesced. */
export class History {
  private stack: string[] = [];
  private idx = -1;
  private lastKey = "";
  private lastTime = 0;

  reset(p: Project): void {
    this.stack = [JSON.stringify(p)];
    this.idx = 0;
    this.lastKey = "";
  }

  commit(p: Project, key = ""): void {
    const snap = JSON.stringify(p);
    if (snap === this.stack[this.idx]) return;
    const now = Date.now();
    this.stack = this.stack.slice(0, this.idx + 1);
    if (key && key === this.lastKey && now - this.lastTime < 800 && this.idx > 0) {
      this.stack[this.idx] = snap;
    } else {
      this.stack.push(snap);
      this.idx++;
      if (this.stack.length > 200) { this.stack.shift(); this.idx--; }
    }
    this.lastKey = key;
    this.lastTime = now;
  }

  canUndo(): boolean { return this.idx > 0; }
  canRedo(): boolean { return this.idx < this.stack.length - 1; }
  undo(): string | null { if (!this.canUndo()) return null; this.lastKey = ""; return this.stack[--this.idx]; }
  redo(): string | null { if (!this.canRedo()) return null; this.lastKey = ""; return this.stack[++this.idx]; }
}
