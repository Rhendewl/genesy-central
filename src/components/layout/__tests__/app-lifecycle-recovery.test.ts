import { describe, expect, it } from "vitest";
import { canRemountAppForRecovery } from "@/lib/app-lifecycle-recovery";

describe("AppLifecycleRecovery", () => {
  it("permite recuperar a árvore quando não há modal aberto", () => {
    expect(canRemountAppForRecovery(0)).toBe(true);
  });

  it("preserva a árvore e os rascunhos quando há um modal aberto", () => {
    expect(canRemountAppForRecovery(1)).toBe(false);
    expect(canRemountAppForRecovery(2)).toBe(false);
  });

  it("preserva a árvore quando um editor registra estado ativo", () => {
    expect(canRemountAppForRecovery(0, 1)).toBe(false);
    expect(canRemountAppForRecovery(0, 2)).toBe(false);
  });

  it("só remonta quando não há modal nem editor ativo", () => {
    expect(canRemountAppForRecovery(1, 1)).toBe(false);
    expect(canRemountAppForRecovery(0, 0)).toBe(true);
  });
});
