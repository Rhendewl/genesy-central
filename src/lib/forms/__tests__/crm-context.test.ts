import { describe, expect, it } from "vitest";
import { formatFormLeadName, formAttributionLines } from "../crm-context";

describe("form CRM context", () => {
  it("adds the configured label and preserves forms without a label", () => {
    expect(formatFormLeadName("Maria", " Form Villa Real ")).toBe("Maria | Form Villa Real");
    expect(formatFormLeadName("Maria", undefined)).toBe("Maria");
    expect(formatFormLeadName(null, "Villa Real")).toBe("Sem nome | Villa Real");
  });
  it("keeps real campaign and creative identifiers and omits absent values", () => {
    expect(formAttributionLines({ utm_source: "meta", utm_campaign: "Villa Real", utm_content: "video_02", gclid: null }))
      .toEqual(["utm_source: meta", "utm_campaign: Villa Real", "utm_content: video_02"]);
    expect(formAttributionLines(null)).toEqual([]);
  });
});
