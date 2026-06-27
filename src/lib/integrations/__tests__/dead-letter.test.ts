import { describe, it, expect } from "vitest";
import { DeadLetterQueue } from "../dead-letter";
import { makeConfig, makeEvent } from "./helpers";

function makeEntry(id: string) {
  return {
    deliveryId:    id,
    correlationId: "corr",
    event:         makeEvent(),
    config:        makeConfig(),
    lastError:     "HTTP 500",
    attempts:      3,
    failedAt:      Date.now(),
  };
}

describe("DeadLetterQueue", () => {
  it("starts empty", () => {
    const dlq = new DeadLetterQueue();
    expect(dlq.size()).toBe(0);
    expect(dlq.all()).toHaveLength(0);
  });

  it("adds entries and returns them via all()", () => {
    const dlq = new DeadLetterQueue();
    dlq.add(makeEntry("a"));
    dlq.add(makeEntry("b"));
    expect(dlq.size()).toBe(2);
    expect(dlq.all().map(e => e.deliveryId)).toEqual(["a", "b"]);
  });

  it("peek() returns last N entries (most recent)", () => {
    const dlq = new DeadLetterQueue();
    dlq.add(makeEntry("1"));
    dlq.add(makeEntry("2"));
    dlq.add(makeEntry("3"));
    const result = dlq.peek(2);
    expect(result.map(e => e.deliveryId)).toEqual(["2", "3"]);
  });

  it("peek() clamps to actual size", () => {
    const dlq = new DeadLetterQueue();
    dlq.add(makeEntry("x"));
    expect(dlq.peek(100)).toHaveLength(1);
  });

  it("evicts oldest entry when maxSize is reached", () => {
    const dlq = new DeadLetterQueue(3);
    dlq.add(makeEntry("a"));
    dlq.add(makeEntry("b"));
    dlq.add(makeEntry("c"));
    dlq.add(makeEntry("d")); // evicts "a"
    expect(dlq.size()).toBe(3);
    expect(dlq.all().map(e => e.deliveryId)).toEqual(["b", "c", "d"]);
  });

  it("clear() removes all entries", () => {
    const dlq = new DeadLetterQueue();
    dlq.add(makeEntry("a"));
    dlq.clear();
    expect(dlq.size()).toBe(0);
    expect(dlq.all()).toHaveLength(0);
  });
});
