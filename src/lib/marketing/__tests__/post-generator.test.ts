import { describe, expect, it } from "vitest";
import { defaultPostLineHeight, numberedSlideFilename, sanitizeDownloadName } from "@/lib/marketing/post-generator";

describe("sanitizeDownloadName", () => {
  it("preserva o nome escolhido e remove uma extensão zip duplicada", () => {
    expect(sanitizeDownloadName("Campanha Agosto.zip")).toBe("Campanha Agosto");
  });

  it("substitui caracteres inválidos para nomes de arquivo", () => {
    expect(sanitizeDownloadName("Stories: cliente/lançamento?"))
      .toBe("Stories- cliente-lançamento-");
  });

  it("usa um nome seguro quando o campo fica vazio", () => {
    expect(sanitizeDownloadName("   ", "stories-plus")).toBe("stories-plus");
  });
});

describe("numberedSlideFilename", () => {
  it("usa somente o número fixo do slide", () => {
    expect(numberedSlideFilename(0)).toBe("1.png");
    expect(numberedSlideFilename(6)).toBe("7.png");
  });
});

describe("defaultPostLineHeight", () => {
  it("inicia o Stories Plus com 115 pixels entre linhas", () => {
    expect(defaultPostLineHeight("stories")).toBe(115);
  });
});
