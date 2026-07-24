import { describe, expect, it } from "vitest";
import { progressGradientFrom } from "../progress-color";

describe("progressGradientFrom", () => {
  it("preserva a base escura no tema escuro", () => {
    expect(progressGradientFrom(75, "dark")).toContain("55%, black");
  });

  it("começa em um tom claro da cor no tema claro", () => {
    expect(progressGradientFrom(75, "light")).toContain("36%, white");
  });
});
