import { describe, expect, it } from "vitest";
import { backgroundImageStyle, normalizeBackgroundCrop } from "../post-background";

describe("Stories Plus background", () => {
  it("preserves the centered background of older saved projects", () => {
    expect(normalizeBackgroundCrop()).toEqual({ x: 50, y: 50, zoom: 1 });
    expect(backgroundImageStyle()).toEqual({ objectPosition: "50% 50%", transform: "scale(1)", transformOrigin: "50% 50%" });
  });
  it("uses the same horizontal, vertical and zoom adjustments in every canvas", () => {
    const savedCrop = JSON.parse(JSON.stringify({ x: 25, y: 75, zoom: 2 }));
    expect(backgroundImageStyle(savedCrop)).toEqual({ objectPosition: "25% 75%", transform: "scale(2)", transformOrigin: "25% 75%" });
    expect(normalizeBackgroundCrop({ x: -10, y: 120, zoom: 50 })).toEqual({ x: 0, y: 100, zoom: 2.5 });
    expect(normalizeBackgroundCrop({ x: NaN, y: Infinity, zoom: 0 })).toEqual({ x: 50, y: 50, zoom: 1 });
  });
});
