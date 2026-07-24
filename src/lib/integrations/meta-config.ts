export type MetaDeliveryMode = "browser" | "capi" | "both";

export function getMetaPixelId(settings: Record<string, unknown>): string {
  const value = settings.pixel_id ?? settings.pixelId;
  return typeof value === "string" ? value.trim() : "";
}

export function getMetaDeliveryMode(settings: Record<string, unknown>): MetaDeliveryMode {
  const value = settings.mode;
  if (value === "browser" || value === "capi" || value === "both") return value;
  if (value === "server") return "capi";

  // A integração se chama Meta Pixel e a tela solicita Pixel ID + token.
  // Configurações antigas sem `mode` devem instalar o Pixel no navegador e
  // também enviar pela CAPI, compartilhando o event_id para deduplicação.
  return "both";
}
