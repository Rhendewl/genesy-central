// In-memory stand-in for the subset of supabase-js used by the automation
// engine: filters, ordering, limits, insert/update/upsert with returning.
import { randomUUID } from "node:crypto";

type Row = Record<string, any>;
type Filter = (row: Row) => boolean;

const DEFAULTS: Record<string, () => Row> = {
  marketing_instagram_automation_events: () => ({ status: "received", received_at: new Date().toISOString() }),
  marketing_instagram_contacts: () => ({ tags: [], crm_lead_id: null, opted_out_at: null, last_message_at: null, ad_window_until: null, username: null }),
  marketing_instagram_automation_runs: () => ({ status: "queued", variables: {}, started_at: null, completed_at: null, crm_lead_id: null, waiting_for: null, wait_until: null }),
  marketing_instagram_automation_jobs: () => ({ status: "pending", attempts: 0, max_attempts: 5, scheduled_for: new Date().toISOString(), locked_at: null, last_error: null, external_message_id: null, completed_at: null }),
};

function read(row: Row, column: string) {
  const json = column.split("->>");
  if (json.length === 2) {
    const value = row[json[0]]?.[json[1]];
    return value === undefined || value === null ? null : String(value);
  }
  return row[column];
}

function clone<T>(value: T): T { return value === undefined ? value : JSON.parse(JSON.stringify(value)); }

class Query implements PromiseLike<{ data: any; error: any; count?: number | null }> {
  private filters: Filter[] = [];
  private orderBy: Array<{ column: string; ascending: boolean }> = [];
  private max: number | null = null;
  private mode: "select" | "insert" | "update" | "upsert" | "delete" = "select";
  private values: any = null;
  private options: Record<string, any> = {};
  private returning = false;
  private singleMode: "single" | "maybe" | null = null;
  private countMode = false;
  private head = false;

  constructor(private db: FakeSupabase, private table: string) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (this.mode === "select") { this.countMode = Boolean(options?.count); this.head = Boolean(options?.head); }
    else this.returning = true;
    return this;
  }
  insert(values: any) { this.mode = "insert"; this.values = values; return this; }
  update(values: any) { this.mode = "update"; this.values = values; return this; }
  upsert(values: any, options: Record<string, any> = {}) { this.mode = "upsert"; this.values = values; this.options = options; return this; }
  delete() { this.mode = "delete"; return this; }
  eq(column: string, value: unknown) { this.filters.push(row => read(row, column) === value); return this; }
  neq(column: string, value: unknown) { this.filters.push(row => read(row, column) !== value); return this; }
  in(column: string, values: unknown[]) { this.filters.push(row => values.includes(read(row, column))); return this; }
  lt(column: string, value: any) { this.filters.push(row => read(row, column) !== null && read(row, column) < value); return this; }
  lte(column: string, value: any) { this.filters.push(row => read(row, column) !== null && read(row, column) <= value); return this; }
  gt(column: string, value: any) { this.filters.push(row => read(row, column) !== null && read(row, column) > value); return this; }
  gte(column: string, value: any) { this.filters.push(row => read(row, column) !== null && read(row, column) >= value); return this; }
  order(column: string, options: { ascending?: boolean } = {}) { this.orderBy.push({ column, ascending: options.ascending !== false }); return this; }
  limit(count: number) { this.max = count; return this; }
  maybeSingle() { this.singleMode = "maybe"; return this; }
  single() { this.singleMode = "single"; return this; }

  then<A, B>(resolve?: ((value: any) => A | PromiseLike<A>) | null, reject?: ((reason: any) => B | PromiseLike<B>) | null) {
    return Promise.resolve().then(() => this.execute()).then(resolve, reject);
  }

  private matches(row: Row) { return this.filters.every(filter => filter(row)); }

  private execute() {
    const rows = this.db.rows(this.table);
    let result: Row[] = [];
    if (this.mode === "select") {
      result = rows.filter(row => this.matches(row));
      if (this.countMode && this.head) return { data: null, error: null, count: result.length };
    } else if (this.mode === "insert") {
      const list = Array.isArray(this.values) ? this.values : [this.values];
      for (const value of list) {
        const error = this.db.violatesUnique(this.table, value);
        if (error) return { data: null, error: { message: error } };
      }
      result = list.map(value => this.db.add(this.table, value));
    } else if (this.mode === "update") {
      result = rows.filter(row => this.matches(row));
      result.forEach(row => Object.assign(row, clone(this.values)));
    } else if (this.mode === "delete") {
      const doomed = rows.filter(row => this.matches(row));
      this.db.tables.set(this.table, rows.filter(row => !doomed.includes(row)));
      result = doomed;
    } else {
      const keys = String(this.options.onConflict ?? "id").split(",");
      const list = Array.isArray(this.values) ? this.values : [this.values];
      for (const value of list) {
        const existing = rows.find(row => keys.every(key => row[key] === value[key]));
        if (existing && this.options.ignoreDuplicates) continue;
        if (existing) { Object.assign(existing, clone(value)); result.push(existing); }
        else result.push(this.db.add(this.table, value));
      }
    }
    if (this.mode !== "select" && !this.returning) return { data: null, error: null };
    for (const { column, ascending } of [...this.orderBy].reverse()) {
      result = [...result].sort((a, b) => (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) * (ascending ? 1 : -1));
    }
    if (this.max !== null) result = result.slice(0, this.max);
    const data = clone(result);
    if (this.singleMode === "maybe") return { data: data[0] ?? null, error: data.length > 1 ? { message: "multiple rows" } : null };
    if (this.singleMode === "single") return data.length === 1 ? { data: data[0], error: null } : { data: null, error: { message: "row not found" } };
    return { data, error: null, count: this.countMode ? data.length : null };
  }
}

export class FakeSupabase {
  tables = new Map<string, Row[]>();
  unique: Record<string, string[][]> = {
    marketing_instagram_automation_jobs: [["run_id", "step_index"]],
    marketing_instagram_automation_runs: [["automation_id", "event_id"]],
  };
  private sequence = 0;

  rows(table: string) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }

  violatesUnique(table: string, value: Row) {
    for (const keys of this.unique[table] ?? []) {
      if (this.rows(table).some(row => keys.every(key => row[key] === value[key]))) return `duplicate key ${keys.join(",")}`;
    }
    return null;
  }

  add(table: string, value: Row) {
    this.sequence += 1;
    const createdAt = new Date(Date.now() + this.sequence).toISOString();
    const row = { id: randomUUID(), created_at: createdAt, updated_at: createdAt, ...(DEFAULTS[table]?.() ?? {}), ...clone(value) };
    this.rows(table).push(row);
    return row;
  }

  seed(table: string, value: Row) { return this.add(table, value); }

  from(table: string) {
    return new Query(this, table);
  }
}
