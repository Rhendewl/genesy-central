import type { DeadLetterEntry } from "./types";

export class DeadLetterQueue {
  private readonly entries: DeadLetterEntry[] = [];
  private readonly maxSize: number;

  constructor(maxSize = 1_000) { this.maxSize = maxSize; }

  add(entry: DeadLetterEntry): void {
    if (this.entries.length >= this.maxSize) this.entries.shift(); // evict oldest
    this.entries.push(entry);
  }

  peek(limit = 50): DeadLetterEntry[] {
    return this.entries.slice(-Math.min(limit, this.entries.length));
  }

  all(): DeadLetterEntry[] { return [...this.entries]; }
  size(): number           { return this.entries.length; }
  clear(): void            { this.entries.length = 0; }
}
