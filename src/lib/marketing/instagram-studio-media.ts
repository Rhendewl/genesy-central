import type { InstagramStudioFormat, StudioImageRatio } from "./instagram-studio";
export type StudioDraftAsset = { id: string; source: File; file: Blob; poster: Blob; url: string; type: "image/jpeg" | "video/mp4" | "video/quicktime"; altText: string };
const encode = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Não foi possível preparar a imagem.")), "image/jpeg", quality));
export async function prepareStudioImage(source: File, format: InstagramStudioFormat, fit: "contain" | "cover", ratio: StudioImageRatio = "square"): Promise<StudioDraftAsset> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(source.type) || source.size > 25 * 1024 * 1024) throw new Error("Escolha uma imagem JPG, PNG ou WebP de até 25 MB.");
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas"); canvas.width = ratio === "landscape" ? 1080 : 1080; canvas.height = format === "story" ? 1920 : ratio === "square" ? 1080 : ratio === "portrait" ? 1350 : 566;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Não foi possível preparar a prévia.");
    ctx.fillStyle = "#0b0b0b"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = (fit === "cover" ? Math.max : Math.min)(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = bitmap.width * scale, height = bitmap.height * scale;
    ctx.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    let file = await encode(canvas, .9);
    if (file.size > 3 * 1024 * 1024) file = await encode(canvas, .72);
    if (file.size > 3 * 1024 * 1024) throw new Error("A imagem ficou muito grande. Use um arquivo mais leve.");
    const thumb = document.createElement("canvas"); thumb.width = 270; thumb.height = canvas.height / 4;
    thumb.getContext("2d")?.drawImage(canvas, 0, 0, thumb.width, thumb.height);
    return { id: crypto.randomUUID(), source, file, poster: await encode(thumb, .75), url: URL.createObjectURL(file), type: "image/jpeg", altText: "" };
  } finally { bitmap.close(); }
}
export async function prepareStudioVideo(source: File, format: InstagramStudioFormat): Promise<StudioDraftAsset> {
  const isMov = source.type === "video/quicktime" || source.name.toLowerCase().endsWith(".mov");
  const type = isMov ? "video/quicktime" : source.type;
  if ((type !== "video/mp4" && type !== "video/quicktime") || source.size > 300 * 1024 * 1024) throw new Error("Use um vídeo MP4 ou MOV de até 300 MB, com H.264/AAC.");
  if (format !== "reel" && type === "video/quicktime") throw new Error("Arquivos MOV são aceitos para Reels.");
  if (format !== "reel" && format !== "story") throw new Error("Selecione Reel ou Story para enviar um vídeo.");
  const url = URL.createObjectURL(source);
  const video = document.createElement("video"); video.preload = "auto"; video.muted = true; video.playsInline = true;
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("Não foi possível abrir o vídeo. Exporte em MP4 H.264/AAC.")), 20000);
      video.onloadeddata = () => { window.clearTimeout(timer); resolve(); };
      video.onerror = () => { window.clearTimeout(timer); reject(new Error("Não foi possível abrir este MP4. Exporte em H.264/AAC.")); };
      video.src = url;
    });
    if (!Number.isFinite(video.duration) || video.duration < 3 || video.duration > (format === "story" ? 60 : 900)) throw new Error(format === "story" ? "O vídeo do Story deve ter de 3 a 60 segundos." : "O Reel deve ter de 3 segundos a 15 minutos.");
    if (Math.abs(video.videoWidth / video.videoHeight - 9 / 16) > .03 || video.videoWidth > 1920) throw new Error("Use um vídeo vertical 9:16, com até 1920 pixels de largura.");
    const canvas = document.createElement("canvas"); canvas.width = 270; canvas.height = 480;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Não foi possível gerar a capa do vídeo.");
    ctx.drawImage(video, 0, 0, 270, 480);
    return { id: crypto.randomUUID(), source, file: source, poster: await encode(canvas, .8), url, type, altText: "" };
  } catch (error) { URL.revokeObjectURL(url); throw error; }
  finally { video.pause(); video.removeAttribute("src"); video.load(); }
}
