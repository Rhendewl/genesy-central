import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultPostLetterSpacing, defaultPostLineHeight, normalizePostLineHeight, normalizePostTextWidth, numberedSlideFilename, postElementToPng, sanitizeDownloadName } from "@/lib/marketing/post-generator";

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
  it("inicia todos os modelos com entrelinha de 120%", () => {
    expect(defaultPostLineHeight("stories")).toBe(1.2);
    expect(defaultPostLineHeight("tweet")).toBe(1.2);
  });

  it("converte os 115 pixels salvos pela versão anterior para 115%", () => {
    expect(normalizePostLineHeight("stories", 115)).toBe(1.15);
  });

  it("preserva proporções válidas e limita valores extremos", () => {
    expect(normalizePostLineHeight("stories", 1.3)).toBe(1.3);
    expect(normalizePostLineHeight("stories", 500)).toBe(1.8);
  });
});

describe("defaultPostLetterSpacing", () => {
  it("adiciona 1% de espaçamento padrão ao Stories Plus", () => {
    expect(defaultPostLetterSpacing("stories")).toBe(0.01);
    expect(defaultPostLetterSpacing("tweet")).toBe(0);
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
  const drawImage = vi.fn();
  const raster = "data:image/png;base64,cHJlcGFyZWQ=";

  beforeEach(() => {
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(1200);
    vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(800);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(raster);
    drawImage.mockClear();
    toBlobMock.mockReset().mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("incorpora fundo e imagem complementar no PNG sem modificar o editor", async () => {
    const element = document.createElement("div");
    element.innerHTML = '<img src="blob:background" alt="Fundo"><img src="https://example.com/photo.webp" srcset="other.webp 2x" alt="Mídia">';
    const original = element.innerHTML;
    const expected = new Blob(["final"], { type: "image/png" });
    toBlobMock.mockImplementationOnce(async (clone: HTMLElement) => {
      expect(document.body.contains(clone)).toBe(true);
      const images = Array.from(clone.querySelectorAll("img"));
      expect(images).toHaveLength(2);
      expect(images.every((image) => image.src === raster && !image.hasAttribute("srcset"))).toBe(true);
      return new Blob(["warmup"]);
    });
    toBlobMock.mockResolvedValueOnce(expected);
    await expect(postElementToPng(element, 1080, 1350)).resolves.toBe(expected);
    expect(drawImage).toHaveBeenCalledTimes(2);
    expect(toBlobMock).toHaveBeenCalledTimes(2);
    const clone = toBlobMock.mock.calls[0][0] as HTMLElement;
    expect(clone).not.toBe(element);
    expect(clone.querySelector("img")?.src).toBe(raster);
    expect(clone.querySelectorAll("img")[1].hasAttribute("srcset")).toBe(false);
    expect(element.innerHTML).toBe(original);
    expect(document.body.contains(clone)).toBe(false);
  });

  it("bloqueia a exportação quando uma imagem falha, em vez de baixar um slide incompleto", async () => {
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    const element = document.createElement("div");
    element.innerHTML = '<img src="broken.png">';
    await expect(postElementToPng(element, 1080, 1920)).rejects.toThrow("Anexe-a novamente");
    expect(toBlobMock).not.toHaveBeenCalled();
  });

  it("interrompe a exportação se uma imagem externa não permite incorporação", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => { throw new DOMException("Tainted", "SecurityError"); });
    const element = document.createElement("div");
    element.innerHTML = '<img src="https://example.com/photo.png">';
    await expect(postElementToPng(element, 1080, 1920)).rejects.toThrow("anexe o arquivo");
    expect(toBlobMock).not.toHaveBeenCalled();
  });

  it("remove a cópia temporária mesmo se a geração falhar", async () => {
    toBlobMock.mockRejectedValue(new Error("render failed"));
    await expect(postElementToPng(document.createElement("div"), 1080, 1920)).rejects.toThrow("render failed");
    expect(document.body.contains(toBlobMock.mock.calls[0][0])).toBe(false);
  });

  it("gera slides sem imagens sem renderização extra", async () => {
    await postElementToPng(document.createElement("div"), 1080, 1920);
    expect(toBlobMock).toHaveBeenCalledTimes(1);
    expect(drawImage).not.toHaveBeenCalled();
  });
});
