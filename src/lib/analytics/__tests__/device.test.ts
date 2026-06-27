import { describe, it, expect } from "vitest";
import {
  detectDevice,
  detectBrowser,
  detectOS,
  collectDeviceInfo,
  collectUtmParams,
} from "../device";

// ── detectDevice ──────────────────────────────────────────────────────────────

describe("detectDevice()", () => {
  it("returns 'mobile' for iPhone UA", () => {
    expect(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)")).toBe("mobile");
  });
  it("returns 'mobile' for Android phone UA", () => {
    expect(detectDevice("Mozilla/5.0 (Linux; Android 13; Pixel 7) Mobile")).toBe("mobile");
  });
  it("returns 'tablet' for iPad UA", () => {
    expect(detectDevice("Mozilla/5.0 (iPad; CPU OS 15_0)")).toBe("tablet");
  });
  it("returns 'desktop' for desktop Chrome UA", () => {
    expect(detectDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")).toBe("desktop");
  });
  it("returns 'desktop' for empty UA", () => {
    expect(detectDevice("")).toBe("desktop");
  });
});

// ── detectBrowser ─────────────────────────────────────────────────────────────

describe("detectBrowser()", () => {
  it("detects Chrome", () => {
    expect(detectBrowser("Mozilla/5.0 (Windows NT) Chrome/117.0.0.0 Safari/537.36")).toBe("Chrome");
  });
  it("detects Edge (Edg/ prefix)", () => {
    expect(detectBrowser("Mozilla/5.0 (Windows NT) Chrome/117 Edg/117.0")).toBe("Edge");
  });
  it("detects Opera (OPR/ prefix)", () => {
    expect(detectBrowser("Mozilla/5.0 (Windows NT) Chrome/117 OPR/103.0")).toBe("Opera");
  });
  it("detects Firefox", () => {
    expect(detectBrowser("Mozilla/5.0 (Windows NT; rv:109.0) Gecko Firefox/109.0")).toBe("Firefox");
  });
  it("detects Safari (without Chrome)", () => {
    expect(detectBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit Safari/537.36")).toBe("Safari");
  });
  it("detects IE (MSIE)", () => {
    expect(detectBrowser("Mozilla/5.0 (compatible; MSIE 10.0; Windows NT)")).toBe("IE");
  });
  it("returns Other for unknown UA", () => {
    expect(detectBrowser("Googlebot/2.1")).toBe("Other");
  });
});

// ── detectOS ──────────────────────────────────────────────────────────────────

describe("detectOS()", () => {
  it("detects iOS", () => {
    expect(detectOS("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)")).toBe("iOS");
  });
  it("detects Android", () => {
    expect(detectOS("Mozilla/5.0 (Linux; Android 13; Pixel 7)")).toBe("Android");
  });
  it("detects macOS", () => {
    expect(detectOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("macOS");
  });
  it("detects Windows", () => {
    expect(detectOS("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("Windows");
  });
  it("detects Windows Phone (takes priority over Windows)", () => {
    expect(detectOS("Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0)")).toBe("Windows Phone");
  });
  it("detects Linux", () => {
    expect(detectOS("Mozilla/5.0 (X11; Linux x86_64)")).toBe("Linux");
  });
  it("returns Other for unknown UA", () => {
    expect(detectOS("UnknownBot/1.0")).toBe("Other");
  });
});

// ── collectDeviceInfo ─────────────────────────────────────────────────────────

describe("collectDeviceInfo()", () => {
  it("returns a DeviceInfo with device/browser/os/language", () => {
    const info = collectDeviceInfo();
    expect(info).toHaveProperty("device");
    expect(info).toHaveProperty("browser");
    expect(info).toHaveProperty("os");
    expect(info).toHaveProperty("language");
    expect(typeof info.language).toBe("string");
    expect(info.language.length).toBeGreaterThan(0);
  });

  it("returns string values for all fields", () => {
    const info = collectDeviceInfo();
    expect(typeof info.device).toBe("string");
    expect(typeof info.browser).toBe("string");
    expect(typeof info.os).toBe("string");
  });
});

// ── collectUtmParams ──────────────────────────────────────────────────────────

describe("collectUtmParams()", () => {
  it("returns empty object when no search and no referrer", () => {
    expect(collectUtmParams("", "")).toEqual({});
  });

  it("extracts utm_source from query string", () => {
    const result = collectUtmParams("?utm_source=google&utm_medium=cpc");
    expect(result.utm_source).toBe("google");
    expect(result.utm_medium).toBe("cpc");
  });

  it("extracts all UTM params", () => {
    const result = collectUtmParams(
      "?utm_source=fb&utm_medium=social&utm_campaign=summer&utm_term=test&utm_content=ad1",
    );
    expect(result.utm_source).toBe("fb");
    expect(result.utm_medium).toBe("social");
    expect(result.utm_campaign).toBe("summer");
    expect(result.utm_term).toBe("test");
    expect(result.utm_content).toBe("ad1");
  });

  it("includes referrer when provided", () => {
    const result = collectUtmParams("", "https://google.com/");
    expect(result.referrer).toBe("https://google.com/");
  });

  it("handles query string without '?'", () => {
    const result = collectUtmParams("utm_source=email");
    expect(result.utm_source).toBe("email");
  });

  it("ignores unknown params", () => {
    const result = collectUtmParams("?foo=bar&baz=qux");
    expect(result).not.toHaveProperty("foo");
    expect(result).not.toHaveProperty("baz");
  });

  it("returns empty when no UTM keys present and no referrer", () => {
    const result = collectUtmParams("?page=1", "");
    expect(result).toEqual({});
  });
});
