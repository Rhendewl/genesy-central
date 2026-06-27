import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryAdapter, LocalStorageAdapter } from "../storage";

// ── InMemoryAdapter ───────────────────────────────────────────────────────────

describe("InMemoryAdapter", () => {
  let adapter: InMemoryAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  it("stores and retrieves a value", () => {
    adapter.set("key1", "hello");
    expect(adapter.get("key1")).toBe("hello");
  });

  it("returns null for a missing key", () => {
    expect(adapter.get("nonexistent")).toBeNull();
  });

  it("overwrites an existing key", () => {
    adapter.set("key1", "first");
    adapter.set("key1", "second");
    expect(adapter.get("key1")).toBe("second");
  });

  it("removes a key", () => {
    adapter.set("key1", "value");
    adapter.remove("key1");
    expect(adapter.get("key1")).toBeNull();
  });

  it("remove on missing key is a no-op", () => {
    expect(() => adapter.remove("nonexistent")).not.toThrow();
  });

  it("lists keys matching a prefix", () => {
    adapter.set("bus_a", "1");
    adapter.set("bus_b", "2");
    adapter.set("other_c", "3");
    const keys = adapter.keys("bus_");
    expect(keys).toHaveLength(2);
    expect(keys).toContain("bus_a");
    expect(keys).toContain("bus_b");
    expect(keys).not.toContain("other_c");
  });

  it("returns empty array when no keys match prefix", () => {
    adapter.set("foo", "bar");
    expect(adapter.keys("xyz_")).toHaveLength(0);
  });

  it("clears all keys with a given prefix", () => {
    adapter.set("ns_a", "1");
    adapter.set("ns_b", "2");
    adapter.set("other", "3");
    adapter.clear("ns_");
    expect(adapter.get("ns_a")).toBeNull();
    expect(adapter.get("ns_b")).toBeNull();
    expect(adapter.get("other")).toBe("3");
  });

  it("size() reports the correct entry count", () => {
    expect(adapter.size()).toBe(0);
    adapter.set("a", "1");
    adapter.set("b", "2");
    expect(adapter.size()).toBe(2);
    adapter.remove("a");
    expect(adapter.size()).toBe(1);
  });

  it("stores arbitrary string values (JSON serialized data)", () => {
    const payload = JSON.stringify({ nested: { value: [1, 2, 3] } });
    adapter.set("json_key", payload);
    expect(JSON.parse(adapter.get("json_key")!)).toEqual({ nested: { value: [1, 2, 3] } });
  });
});

// ── LocalStorageAdapter ───────────────────────────────────────────────────────

describe("LocalStorageAdapter", () => {
  let adapter: LocalStorageAdapter;

  beforeEach(() => {
    localStorage.clear();
    adapter = new LocalStorageAdapter();
  });

  it("stores and retrieves a value", () => {
    adapter.set("lskey", "value");
    expect(adapter.get("lskey")).toBe("value");
  });

  it("returns null for a missing key", () => {
    expect(adapter.get("missing")).toBeNull();
  });

  it("overwrites an existing key", () => {
    adapter.set("lskey", "first");
    adapter.set("lskey", "second");
    expect(adapter.get("lskey")).toBe("second");
  });

  it("removes a key", () => {
    adapter.set("lskey", "value");
    adapter.remove("lskey");
    expect(adapter.get("lskey")).toBeNull();
  });

  it("lists keys by prefix", () => {
    adapter.set("prefix_a", "1");
    adapter.set("prefix_b", "2");
    adapter.set("other_c", "3");
    const keys = adapter.keys("prefix_");
    expect(keys).toHaveLength(2);
    expect(keys).toContain("prefix_a");
    expect(keys).toContain("prefix_b");
  });

  it("returns empty array when no keys match prefix", () => {
    expect(adapter.keys("nope_")).toHaveLength(0);
  });

  it("clears keys matching a prefix, leaves others intact", () => {
    adapter.set("ns_a", "1");
    adapter.set("ns_b", "2");
    adapter.set("keep_c", "3");
    adapter.clear("ns_");
    expect(adapter.get("ns_a")).toBeNull();
    expect(adapter.get("ns_b")).toBeNull();
    expect(adapter.get("keep_c")).toBe("3");
  });

  it("persists across multiple adapter instances (same underlying storage)", () => {
    adapter.set("shared_key", "shared_value");
    const adapter2 = new LocalStorageAdapter();
    expect(adapter2.get("shared_key")).toBe("shared_value");
  });
});
