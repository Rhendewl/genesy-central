export type PdfDeliveryResult = "shared" | "downloaded" | "cancelled";

function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function deliverPdfBlob(blob: Blob, filename: string, title: string): Promise<PdfDeliveryResult> {
  const file = new File([blob], filename, { type: "application/pdf" });
  let canShareFile = false;
  if (typeof navigator.share === "function") {
    try {
      canShareFile = typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] });
    } catch {
      canShareFile = false;
    }
  }

  if (canShareFile) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // PWAs may expose Web Share but reject files in a specific installation.
      // In that case the regular browser download remains a usable fallback.
    }
  }

  downloadPdfBlob(blob, filename);
  return "downloaded";
}
