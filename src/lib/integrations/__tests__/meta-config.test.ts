import { describe, expect, it } from "vitest";
import { getMetaDeliveryMode, getMetaPixelId } from "../meta-config";

describe("Meta integration config compatibility", () => {
  it("reads the pixelId key saved by the current configuration screen", () => {
    expect(getMetaPixelId({ pixelId: " 123456 " })).toBe("123456");
  });

  it("reads the legacy pixel_id key", () => {
    expect(getMetaPixelId({ pixel_id: "654321" })).toBe("654321");
  });

  it("defaults configurations without mode to browser + CAPI", () => {
    expect(getMetaDeliveryMode({ pixelId: "123456" })).toBe("both");
  });

  it("preserves explicit modes and normalizes server to capi", () => {
    expect(getMetaDeliveryMode({ mode: "browser" })).toBe("browser");
    expect(getMetaDeliveryMode({ mode: "capi" })).toBe("capi");
    expect(getMetaDeliveryMode({ mode: "both" })).toBe("both");
    expect(getMetaDeliveryMode({ mode: "server" })).toBe("capi");
  });
});
