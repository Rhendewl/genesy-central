import { describe, expect, it } from "vitest";
import { hasNewAppVersion, normalizeAppVersion } from "@/lib/app-version";

describe("app version", () => {
  it("normaliza somente identificadores válidos", () => {
    expect(normalizeAppVersion("  abc123  ")).toBe("abc123");
    expect(normalizeAppVersion(123)).toBeNull();
    expect(normalizeAppVersion(" ")).toBeNull();
  });

  it("detecta quando o servidor publicou uma versão diferente", () => {
    expect(hasNewAppVersion("abc123", "def456")).toBe(true);
    expect(hasNewAppVersion("abc123", "abc123")).toBe(false);
  });

  it("não exibe o aviso no ambiente de desenvolvimento", () => {
    expect(hasNewAppVersion("development", "def456")).toBe(false);
    expect(hasNewAppVersion("abc123", "development")).toBe(false);
  });
});
