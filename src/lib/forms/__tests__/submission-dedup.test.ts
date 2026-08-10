import { describe, expect, it } from "vitest";
import {
  canonicalAnswers,
  duplicateSubmissionCutoff,
  findExactDuplicateSubmission,
} from "../submission-dedup";

describe("submission deduplication", () => {
  it("considera iguais respostas com chaves em ordens diferentes", () => {
    expect(canonicalAnswers({ phone: "123", nested: { b: 2, a: 1 } }))
      .toBe(canonicalAnswers({ nested: { a: 1, b: 2 }, phone: "123" }));
  });

  it("só encontra uma repetição quando todas as respostas são idênticas", () => {
    const duplicate = { id: "same", answers: { name: "João", interest: "moradia" } };
    const candidates = [duplicate, { id: "other", answers: { name: "João", interest: "investimento" } }];

    expect(findExactDuplicateSubmission(candidates, { interest: "moradia", name: "João" }))
      .toBe(duplicate);
    expect(findExactDuplicateSubmission(candidates, { name: "João" })).toBeNull();
  });

  it("usa uma janela móvel de 30 dias", () => {
    expect(duplicateSubmissionCutoff(new Date("2026-08-10T12:00:00.000Z")))
      .toBe("2026-07-11T12:00:00.000Z");
  });
});
