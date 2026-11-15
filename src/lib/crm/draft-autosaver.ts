export type SaveStatus = "saved" | "pending" | "saving" | "invalid" | "error";

/** Serializes writes and retains the newest draft while a request is running. */
export class DraftAutosaver<T extends object> {
  private saved: T;
  private draft: T;
  private valid = true;
  private timer?: ReturnType<typeof setTimeout>;
  private flight: Promise<boolean> | null = null;
  private listener: (status: SaveStatus) => void = () => {};
  status: SaveStatus = "saved";

  constructor(initial: T, private persist: (patch: Partial<T>) => Promise<{ error: string | null }>, private delay = 800) {
    this.saved = structuredClone(initial);
    this.draft = structuredClone(initial);
  }
  subscribe(listener: (status: SaveStatus) => void) { this.listener = listener; return () => { this.listener = () => {}; }; }
  private emit(status: SaveStatus) { this.status = status; this.listener(status); }
  private patch() {
    return Object.fromEntries(Object.entries(this.draft).filter(([key, value]) =>
      JSON.stringify(value) !== JSON.stringify(this.saved[key as keyof T]))) as Partial<T>;
  }
  get dirty() { return Object.keys(this.patch()).length > 0; }
  update(value: T, valid: boolean) {
    const changed = JSON.stringify(value) !== JSON.stringify(this.draft) || valid !== this.valid;
    this.draft = structuredClone(value);
    this.valid = valid;
    if (!changed) return;
    this.cancelTimer();
    if (!this.dirty && !this.flight) { this.emit("saved"); return; }
    if (!valid) { this.emit("invalid"); return; }
    this.emit(this.flight ? "saving" : "pending");
    this.timer = setTimeout(() => { void this.flush(); }, this.delay);
  }
  cancelTimer() { clearTimeout(this.timer); }
  flush(): Promise<boolean> {
    this.cancelTimer();
    if (this.flight) return this.flight;
    if (!this.dirty) { this.emit("saved"); return Promise.resolve(true); }
    if (!this.valid) { this.emit("invalid"); return Promise.resolve(false); }
    // Start on a microtask so flight is set even when there are no changes.
    this.flight = Promise.resolve().then(async () => {
      while (this.dirty) {
        if (!this.valid) { this.emit("invalid"); return false; }
        const snapshot = structuredClone(this.draft);
        const patch = this.patch();
        this.emit("saving");
        try {
          const result = await this.persist(patch);
          if (result.error) { this.emit("error"); return false; }
          this.saved = snapshot;
        } catch { this.emit("error"); return false; }
      }
      this.emit("saved");
      return true;
    }).finally(() => { this.flight = null; });
    return this.flight;
  }
}
