import { toBlob } from "html-to-image";

export type PostFormat = "story" | "portrait";
export type PostTemplate = "tweet" | "stories";
export type DownloadDirectory = { getFileHandle(name: string, options: { create: boolean }): Promise<{ createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }> };

export const POST_FORMATS: Record<PostFormat, { label: string; width: number; height: number }> = {
  story: { label: "1080 × 1920", width: 1080, height: 1920 },
  portrait: { label: "1080 × 1350", width: 1080, height: 1350 },
};

async function waitForExportImages(element: HTMLElement) {
  const images = Array.from(element.querySelectorAll("img"));
  await Promise.all(images.map(async (image) => {
    if (!image.complete) await new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("Uma das imagens ainda não está pronta. Tente exportar novamente.");
    if (image.decode) await image.decode().catch(() => undefined);
  }));
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

export async function postElementToPng(element: HTMLElement, width: number, height: number) {
  await document.fonts.ready;
  await waitForExportImages(element);
  const blob = await toBlob(element, {
    width,
    height,
    canvasWidth: width,
    canvasHeight: height,
    pixelRatio: 1,
    cacheBust: false,
    skipAutoScale: true,
  });
  if (!blob) throw new Error("Falha ao gerar o PNG.");
  return blob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
}

export async function chooseDownloadDirectory(): Promise<DownloadDirectory | null | undefined> {
  const desktop = window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 768;
  const picker = (window as Window & { showDirectoryPicker?: (options?: { mode?: "readwrite" }) => Promise<DownloadDirectory> }).showDirectoryPicker;
  if (!desktop || !picker) return undefined;
  try {
    return await picker.call(window, { mode: "readwrite" });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    throw error;
  }
}

export async function saveBlob(blob: Blob, filename: string, directory?: DownloadDirectory) {
  if (!directory) return downloadBlob(blob, filename);
  const file = await directory.getFileHandle(filename, { create: true });
  const writable = await file.createWritable();
  await writable.write(blob);
  await writable.close();
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value++) {
    let crc = value;
    for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    table[value] = crc >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index++) crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function set16(view: DataView, offset: number, value: number) { view.setUint16(offset, value, true); }
function set32(view: DataView, offset: number, value: number) { view.setUint32(offset, value, true); }

export function createZip(files: Array<{ name: string; data: Uint8Array }>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach(({ name, data }) => {
    const filename = encoder.encode(name);
    const crc = crc32(data);
    const local = new Uint8Array(30 + filename.length + data.length);
    const localView = new DataView(local.buffer);
    set32(localView, 0, 0x04034b50); set16(localView, 4, 20); set16(localView, 6, 0x0800);
    set16(localView, 8, 0); set32(localView, 14, crc); set32(localView, 18, data.length); set32(localView, 22, data.length);
    set16(localView, 26, filename.length); local.set(filename, 30); local.set(data, 30 + filename.length);
    localParts.push(local);

    const central = new Uint8Array(46 + filename.length);
    const centralView = new DataView(central.buffer);
    set32(centralView, 0, 0x02014b50); set16(centralView, 4, 20); set16(centralView, 6, 20); set16(centralView, 8, 0x0800);
    set16(centralView, 10, 0); set32(centralView, 16, crc); set32(centralView, 20, data.length); set32(centralView, 24, data.length);
    set16(centralView, 28, filename.length); set32(centralView, 42, offset); central.set(filename, 46);
    centralParts.push(central);
    offset += local.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  set32(endView, 0, 0x06054b50); set16(endView, 8, files.length); set16(endView, 10, files.length);
  set32(endView, 12, centralSize); set32(endView, 16, offset);
  const parts = [...localParts, ...centralParts, end].map((part) => {
    const copy = new Uint8Array(part.byteLength);
    copy.set(part);
    return copy.buffer;
  });
  return new Blob(parts, { type: "application/zip" });
}
