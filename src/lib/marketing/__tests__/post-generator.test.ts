import { describe, expect, it, vi } from "vitest";
import { defaultPostLineHeight, normalizePostLineHeight, normalizePostTextWidth, numberedSlideFilename, postElementToPng, sanitizeDownloadName } from "@/lib/marketing/post-generator";

const toBlobMock = vi.hoisted(() => vi.fn());

vi.mock("html-to-image", () => ({ toBlob: toBlobMock }));

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
  it("inicia o Stories Plus com uma proporção confortável de 115%", () => {
    expect(defaultPostLineHeight("stories")).toBe(1.15);
  });

  it("converte os 115 pixels salvos pela versão anterior para 115%", () => {
    expect(normalizePostLineHeight("stories", 115)).toBe(1.15);
  });

  it("preserva proporções válidas e limita valores extremos", () => {
    expect(normalizePostLineHeight("stories", 1.3)).toBe(1.3);
    expect(normalizePostLineHeight("stories", 500)).toBe(1.8);
  });
});

describe("normalizePostTextWidth", () => {
  it("mantém o bloco de Stories Plus dentro das margens seguras", () => {
    expect(normalizePostTextWidth("stories", 500)).toBe(84);
    expect(normalizePostTextWidth("stories", 20)).toBe(40);
    expect(normalizePostTextWidth("stories", 72)).toBe(72);
  });
});

describe("postElementToPng", () => {
  it("aquece a renderização antes do PNG final quando o slide contém imagem", async () => {
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    const element = document.createElement("div");
    const image = document.createElement("img");
    Object.defineProperties(image, {
      complete: { configurable: true, value: true },
      naturalWidth: { configurable: true, value: 1200 },
      naturalHeight: { configurable: true, value: 800 },
      decode: { configurable: true, value: vi.fn().mockResolvedValue(undefined) },
    });
    element.appendChild(image);
    const expected = new Blob(["final"], { type: "image/png" });
    toBlobMock.mockReset().mockResolvedValueOnce(new Blob(["warmup"])).mockResolvedValueOnce(expected);

    await expect(postElementToPng(element, 1080, 1350)).resolves.toBe(expected);
    expect(toBlobMock).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });
});
