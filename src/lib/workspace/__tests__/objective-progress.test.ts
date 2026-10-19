import { describe, it, expect } from "vitest";
import {
  descendants,
  executionProgress,
  metricProgress,
} from "../objective-progress";
describe("objective progress", () => {
  const tree = [
    { id: "a", parent_id: null },
    { id: "b", parent_id: "a" },
    { id: "c", parent_id: "b" },
    { id: "d", parent_id: null },
  ];
  it("includes nested descendants but excludes other roots", () =>
    expect(Array.from(descendants("a", tree))).toEqual(["a", "b", "c"]));
  it("terminates on malformed cyclic client data", () =>
    expect(
      descendants("a", [
        { id: "a", parent_id: "b" },
        { id: "b", parent_id: "a" },
      ]).size,
    ).toBe(2));
  it("deduplicates tasks across descendants and keeps outcomes separate", () =>
    expect(
      executionProgress(
        "a",
        tree,
        [{ id: "s", objective_id: "b", is_completed: true }],
        [
          { objective_id: "a", task_id: "t" },
          { objective_id: "c", task_id: "t" },
          { objective_id: "d", task_id: "other" },
        ],
        [
          { id: "t", status: "a_fazer" },
          { id: "other", status: "concluido" },
        ],
      ),
    ).toMatchObject({ total: 2, done: 1 }));
  it("counts completed tasks and handles empty objectives", () => {
    expect(
      executionProgress(
        "a",
        tree,
        [],
        [{ objective_id: "b", task_id: "t" }],
        [{ id: "t", status: "concluido" }],
      ),
    ).toMatchObject({ total: 1, done: 1 });
    expect(executionProgress("a", tree, [], [], [])).toMatchObject({
      total: 0,
      done: 0,
    });
  });
  it("supports increasing and decreasing metrics and clamps overflow", () => {
    expect(metricProgress(20, 100, 60)).toBe(50);
    expect(metricProgress(100, 20, 60)).toBe(50);
    expect(metricProgress(0, 100, 120)).toBe(100);
    expect(metricProgress(0, 100, -20)).toBe(0);
    expect(metricProgress(0, 0, 20)).toBe(0);
    expect(metricProgress(0, 100, NaN)).toBe(0);
  });
});

