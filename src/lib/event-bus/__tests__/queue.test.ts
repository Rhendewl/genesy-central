import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PersistentQueue } from "../queue";
import { InMemoryAdapter } from "../storage";
import type { BusEvent } from "../types";

// ── Helper ─────────────────────────────────────────────────────────────────────

function makeEvent(id: string, timestampOffset = 0): BusEvent {
  return {
    id,
    type:          "test.event",
    correlationId: "corr-1",
    source:        "test",
    timestamp:     Date.now() + timestampOffset,
    payload:       {},
    meta:          {},
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("PersistentQueue", () => {
  let adapter: InMemoryAdapter;
  let queue:   PersistentQueue;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
    queue   = new PersistentQueue(adapter, "test-source");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── enqueue ──────────────────────────────────────────────────────────────────

  describe("enqueue", () => {
    it("stores an event entry in the adapter", () => {
      queue.enqueue(makeEvent("evt-1"), "consumer-a", 1);
      expect(queue.size()).toBe(1);
    });

    it("stores separate entries for different consumers", () => {
      const event = makeEvent("evt-1");
      queue.enqueue(event, "consumer-a", 1);
      queue.enqueue(event, "consumer-b", 1);
      expect(queue.size()).toBe(2);
    });

    it("overwrites an existing entry for the same (event, consumer) pair", () => {
      const event = makeEvent("evt-1");
      queue.enqueue(event, "consumer-a", 1);
      queue.enqueue(event, "consumer-a", 2); // re-enqueue with higher attempt count
      expect(queue.size()).toBe(1);
    });

    it("evicts the oldest entry when at capacity (100)", () => {
      // Fill to capacity
      for (let i = 0; i < 100; i++) {
        queue.enqueue(makeEvent(`evt-${i}`, i), "consumer-a", 1);
      }
      expect(queue.size()).toBe(100);

      // Add one more → evicts the oldest
      queue.enqueue(makeEvent("evt-new", 200), "consumer-a", 1);
      expect(queue.size()).toBe(100);
    });
  });

  // ── dequeue ───────────────────────────────────────────────────────────────────

  describe("dequeue", () => {
    it("returns entries for the requested consumer only", () => {
      queue.enqueue(makeEvent("evt-1"), "consumer-a", 1);
      queue.enqueue(makeEvent("evt-2"), "consumer-b", 1);

      expect(queue.dequeue("consumer-a")).toHaveLength(1);
      expect(queue.dequeue("consumer-b")).toHaveLength(1);
    });

    it("returns an empty array when the queue is empty", () => {
      expect(queue.dequeue("consumer-a")).toHaveLength(0);
    });

    it("returns entries sorted by event timestamp (FIFO)", () => {
      vi.useFakeTimers();
      const base = 1_000_000;
      vi.setSystemTime(base);
      queue.enqueue({ ...makeEvent("evt-c"), timestamp: base + 200 }, "consumer-a", 1);
      queue.enqueue({ ...makeEvent("evt-a"), timestamp: base },       "consumer-a", 1);
      queue.enqueue({ ...makeEvent("evt-b"), timestamp: base + 100 }, "consumer-a", 1);

      const result = queue.dequeue("consumer-a");
      expect(result[0].event.id).toBe("evt-a");
      expect(result[1].event.id).toBe("evt-b");
      expect(result[2].event.id).toBe("evt-c");
    });

    it("includes the original event payload in the returned entry", () => {
      const event: BusEvent = {
        id:            "evt-payload",
        type:          "form.started",
        correlationId: "corr-abc",
        source:        "form",
        timestamp:     Date.now(),
        payload:       { formSlug: "my-form" },
        meta:          { url: "https://example.com" },
      };
      queue.enqueue(event, "consumer-a", 1);
      const [entry] = queue.dequeue("consumer-a");
      expect(entry.event.payload).toEqual({ formSlug: "my-form" });
      expect(entry.event.correlationId).toBe("corr-abc");
    });
  });

  // ── acknowledge ───────────────────────────────────────────────────────────────

  describe("acknowledge", () => {
    it("removes the entry from the queue", () => {
      queue.enqueue(makeEvent("evt-1"), "consumer-a", 1);
      queue.acknowledge("evt-1", "consumer-a");
      expect(queue.size()).toBe(0);
      expect(queue.dequeue("consumer-a")).toHaveLength(0);
    });

    it("only removes the specific (event, consumer) entry", () => {
      queue.enqueue(makeEvent("evt-1"), "consumer-a", 1);
      queue.enqueue(makeEvent("evt-1"), "consumer-b", 1); // same event, different consumer
      queue.acknowledge("evt-1", "consumer-a");
      expect(queue.size()).toBe(1);
      expect(queue.dequeue("consumer-b")).toHaveLength(1);
    });

    it("is a no-op for a non-existent entry", () => {
      expect(() => queue.acknowledge("nonexistent", "consumer-a")).not.toThrow();
    });
  });

  // ── TTL ───────────────────────────────────────────────────────────────────────

  describe("TTL expiry", () => {
    it("removes expired entries during dequeue", () => {
      vi.useFakeTimers();
      queue.enqueue(makeEvent("evt-expire"), "consumer-a", 1);

      // Advance past 24h TTL
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const result = queue.dequeue("consumer-a");
      expect(result).toHaveLength(0);
    });

    it("decrements size after expiry cleanup", () => {
      vi.useFakeTimers();
      queue.enqueue(makeEvent("evt-1"), "consumer-a", 1);
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      queue.dequeue("consumer-a"); // triggers cleanup
      expect(queue.size()).toBe(0);
    });

    it("non-expired entries survive past short elapsed time", () => {
      vi.useFakeTimers();
      queue.enqueue(makeEvent("evt-fresh"), "consumer-a", 1);
      vi.advanceTimersByTime(60 * 60 * 1000); // 1 hour
      expect(queue.dequeue("consumer-a")).toHaveLength(1);
    });
  });

  // ── corrupt entries ───────────────────────────────────────────────────────────

  describe("corrupt entries", () => {
    it("silently skips and removes corrupt JSON entries during dequeue", () => {
      // Inject a corrupt (non-JSON) entry directly into the adapter
      queue.enqueue(makeEvent("evt-valid"), "consumer-a", 1);
      adapter.set("genesy_bus_q_test-source_consumer-a_corrupt", "{ NOT VALID JSON [[[ }");

      const result = queue.dequeue("consumer-a");
      // The valid entry should still come through; corrupt one is dropped
      expect(result.some(e => e.event.id === "evt-valid")).toBe(true);
      // The corrupt key should have been removed
      expect(adapter.get("genesy_bus_q_test-source_consumer-a_corrupt")).toBeNull();
    });
  });

  // ── size / clear ──────────────────────────────────────────────────────────────

  describe("size() and clear()", () => {
    it("size() returns 0 on empty queue", () => {
      expect(queue.size()).toBe(0);
    });

    it("size() increments with enqueue", () => {
      queue.enqueue(makeEvent("e1"), "c", 1);
      queue.enqueue(makeEvent("e2"), "c", 1);
      expect(queue.size()).toBe(2);
    });

    it("clear() removes all entries for this source", () => {
      queue.enqueue(makeEvent("e1"), "consumer-a", 1);
      queue.enqueue(makeEvent("e2"), "consumer-b", 1);
      queue.clear();
      expect(queue.size()).toBe(0);
    });

    it("clear() does not affect entries from a different source", () => {
      const queueB = new PersistentQueue(adapter, "other-source");
      queue.enqueue(makeEvent("e1"), "consumer-a", 1);
      queueB.enqueue(makeEvent("e2"), "consumer-a", 1);
      queue.clear();
      expect(queue.size()).toBe(0);
      expect(queueB.size()).toBe(1);
    });
  });
});
