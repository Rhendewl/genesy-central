import { describe, expect, it } from "vitest";
import { snapCanvasPosition } from "@/lib/marketing/free-layout";

describe("snapCanvasPosition", () => {
  it("magnetiza o centro do elemento ao centro vertical e horizontal do canvas", () => {
    const result = snapCanvasPosition({ x: 446, y: 906 }, { width: 200, height: 100 }, { width: 1080, height: 1920 }, [], 10);
    expect(result.position).toEqual({ x: 440, y: 910 });
    expect(result.guides).toEqual([{ axis: "x", value: 540 }, { axis: "y", value: 960 }]);
  });

  it("alinha magneticamente a borda esquerda com outro elemento", () => {
    const result = snapCanvasPosition(
      { x: 106, y: 400 },
      { width: 300, height: 200 },
      { width: 1080, height: 1920 },
      [{ x: 100, y: 80, width: 500, height: 100 }],
      10,
    );
    expect(result.position.x).toBe(100);
    expect(result.guides).toContainEqual({ axis: "x", value: 100 });
  });

  it("mantém o elemento dentro dos limites do canvas", () => {
    const result = snapCanvasPosition({ x: 1000, y: -20 }, { width: 200, height: 100 }, { width: 1080, height: 1920 }, [], 0);
    expect(result.position).toEqual({ x: 880, y: 0 });
  });
});
