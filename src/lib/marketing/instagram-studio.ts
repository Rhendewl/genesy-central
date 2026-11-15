export type InstagramStudioFormat = "image" | "carousel" | "reel" | "story";
export const STUDIO_FORMATS: Record<InstagramStudioFormat, string> = { image: "Foto", carousel: "Carrossel", reel: "Reel", story: "Story" };
export const STUDIO_TIME_ZONE = "America/Fortaleza";
export const studioDateKey = (date: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: STUDIO_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
export const studioDateTime = (date: string) => new Intl.DateTimeFormat("pt-BR", { timeZone: STUDIO_TIME_ZONE, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
export function studioSchedule(value: string, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Escolha a data e o horário da publicação.");
  const date = new Date(`${value}:00-03:00`);
  if (!Number.isFinite(date.getTime()) || new Date(date.getTime() - 3 * 3600_000).toISOString().slice(0, 16) !== value || date.getTime() < now + 5 * 60_000) throw new Error("Programe com pelo menos 5 minutos de antecedência (horário de Fortaleza).");
  return date.toISOString();
}
export type StudioImageRatio = "square" | "portrait" | "landscape";
export type StudioAssetManifest = { type: "image/jpeg" | "video/mp4" | "video/quicktime"; size: number };
export function validateStudioAssets(format: unknown, assets: unknown): asserts assets is StudioAssetManifest[] {
  const fail = (message: string) => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!Object.hasOwn(STUDIO_FORMATS, String(format))) fail("Formato de publicação inválido.");
  if (!Array.isArray(assets) || assets.length < 1 || assets.length > 10) fail("Selecione de 1 a 10 arquivos.");
  const list = assets as StudioAssetManifest[];
  if (format === "carousel" ? list.length < 2 : list.length !== 1) fail(format === "carousel" ? "Um carrossel precisa de 2 a 10 imagens." : "Selecione apenas um arquivo para este formato.");
  for (const asset of list) {
    if (!asset || !["image/jpeg", "video/mp4", "video/quicktime"].includes(asset.type) || !Number.isInteger(asset.size) || asset.size <= 0) fail("Arquivo inválido.");
    if ((format === "image" || format === "carousel") && asset.type !== "image/jpeg") fail("O feed e o carrossel desta central usam imagens JPEG.");
    if (format === "reel" && !["video/mp4", "video/quicktime"].includes(asset.type)) fail("Selecione um vídeo MP4 ou MOV para o Reel.");
    if ((format !== "reel" && asset.type === "video/quicktime") || (format === "story" && asset.type === "video/quicktime")) fail("Arquivos MOV são aceitos para Reels.");
    if (asset.size > (asset.type === "video/mp4" || asset.type === "video/quicktime" ? 300 : 3) * 1024 * 1024) fail(asset.type === "video/mp4" || asset.type === "video/quicktime" ? "Use um vídeo de até 300 MB." : "Use uma imagem de até 3 MB.");
  }
}

export type StudioConnection = { id: string; username: string; profile_picture_url: string | null; followers_count?: number; status: string; can_publish: boolean; webhook_subscribed: boolean };
export type StudioPost = { id: string; connection_id: string; scheduled_at: string; caption: string; status: string; last_error: string | null; published_at: string | null; media_kind: string; media_id: string | null; asset_count: number; preview_url: string | null; format: InstagramStudioFormat; asset_urls?: { url: string; type: string }[] };
export type StudioMedia = { id: string; connection_id: string; instagram_media_id: string; media_type: string; media_product_type: string | null; caption: string | null; media_url: string | null; thumbnail_url: string | null; permalink: string | null; published_at: string; likes: number; comments: number; reach: number; saved: number; shares: number; total_interactions: number };
