import { describe, expect, it } from "vitest";
import {
  instagramActionDeadline,
  isInstagramActionWithinWindow,
  isInstagramOptOut,
} from "../policy";

describe("Instagram automation policy guardrails", () => {
  it.each(["PARAR", " parar! ", "Sair", "STOP", "Não quero mais"])("recognizes opt-out command %s", value => {
    expect(isInstagramOptOut(value)).toBe(true);
  });

  it("does not mistake normal conversation for opt-out", () => {
    expect(isInstagramOptOut("Não quero parar de receber novidades")).toBe(false);
    expect(isInstagramOptOut("Quero saber mais")).toBe(false);
  });

  it("uses seven days only for a comment private reply", () => {
    expect(instagramActionDeadline("comment", "2026-08-01T12:00:00.000Z")?.toISOString())
      .toBe("2026-08-08T12:00:00.000Z");
    expect(instagramActionDeadline("message", "2026-08-01T12:00:00.000Z")?.toISOString())
      .toBe("2026-08-02T12:00:00.000Z");
  });

  it("blocks an outbound message after its allowed window", () => {
    expect(isInstagramActionWithinWindow("message", "2026-08-01T12:00:00.000Z", new Date("2026-08-02T12:00:01.000Z"))).toBe(false);
  });
});

