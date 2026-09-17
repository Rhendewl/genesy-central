import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverPdfBlob } from "../pdf-delivery";

describe("deliverPdfBlob", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses native file sharing when the PWA supports it", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share, canShare: () => true });

    await expect(deliverPdfBlob(new Blob(["pdf"], { type: "application/pdf" }), "relatorio.pdf", "Relatório")).resolves.toBe("shared");
    expect(share).toHaveBeenCalledOnce();
  });

  it("downloads the PDF when native sharing is unavailable", async () => {
    const click = vi.fn();
    const anchor = document.createElement("a");
    anchor.click = click;
    vi.spyOn(document, "createElement").mockImplementationOnce(() => anchor);
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("URL", { createObjectURL: () => "blob:report", revokeObjectURL: vi.fn() });

    await expect(deliverPdfBlob(new Blob(["pdf"], { type: "application/pdf" }), "relatorio.pdf", "Relatório")).resolves.toBe("downloaded");
    expect(click).toHaveBeenCalledOnce();
  });
});
