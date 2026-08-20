import { describe, expect, it } from "vitest";
import { calculateGoalTargets, CRM_GOAL_BENCHMARKS } from "../goal-calculator";

describe("goal calculator", () => {
  it("converte receita em volume usando as referências ideais do funil", () => {
    expect(calculateGoalTargets(100_000, 10_000)).toEqual({
      salesTarget: 10,
      heldMeetingsTarget: 50,
      scheduledMeetingsTarget: 67,
    });
  });

  it("arredonda sempre para cima para não subdimensionar a meta", () => {
    expect(calculateGoalTargets(21_000, 10_000)).toEqual({
      salesTarget: 3,
      heldMeetingsTarget: 15,
      scheduledMeetingsTarget: 20,
    });
  });

  it("não calcula sem receita e ticket válidos", () => {
    expect(calculateGoalTargets(0, 10_000)).toBeNull();
    expect(calculateGoalTargets(10_000, 0)).toBeNull();
  });

  it("mantém explícitas as referências usadas", () => {
    expect(CRM_GOAL_BENCHMARKS).toEqual({ closingRate: 20, attendanceRate: 75 });
  });
});
