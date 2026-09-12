import { describe, expect, it } from "vitest";
import { resizeCanvasElement, snapCanvasPosition } from "@/lib/marketing/free-layout";

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

describe("resizeCanvasElement", () => {
  it("mantém a proporção e ancora o canto oposto", () => {
    const result = resizeCanvasElement(
      { x: 100, y: 200 },
      { width: 400, height: 200 },
      "nw",
      { x: -100, y: -50 },
      { width: 1080, height: 1920 },
    );
    expect(result.size).toEqual({ width: 500, height: 250 });
    expect(result.position).toEqual({ x: 0, y: 150 });
  });

  it("respeita os limites do canvas sem deformar", () => {
    const result = resizeCanvasElement(
      { x: 800, y: 1600 },
      { width: 200, height: 200 },
      "se",
      { x: 500, y: 500 },
      { width: 1080, height: 1920 },
    );
    expect(result.size).toEqual({ width: 280, height: 280 });
    expect(result.position).toEqual({ x: 800, y: 1600 });
  });

  it("aplica um tamanho mínimo em reduções grandes", () => {
    const result = resizeCanvasElement(
      { x: 100, y: 100 },
      { width: 300, height: 150 },
      "se",
      { x: -1000, y: -1000 },
      { width: 1080, height: 1920 },
      120,
    );
    expect(result.size).toEqual({ width: 120, height: 60 });
  });
});
