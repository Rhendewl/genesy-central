import type { createAdminSupabaseClient } from "@/lib/supabase-admin";

// Banner do link (og:image) de cada site/página. A escolha fica num arquivo de controle no
// próprio bucket (og/<site>/current.json), que não depende do cache de colunas do Supabase;
// a coluna og_image_url é atualizada junto quando o banco já a reconhece.
type Admin = ReturnType<typeof createAdminSupabaseClient>;
export const OG_BUCKET = "site-assets";
const pointerPath = (siteKey: string) => `og/${siteKey}/current.json`;

export async function readOgImage(admin: Admin, siteKey: string, columnValue?: string | null): Promise<string | null> {
  const { data } = await admin.storage.from(OG_BUCKET).download(pointerPath(siteKey));
  if (data) {
    try {
      const pointer = JSON.parse(await data.text()) as { url?: string | null };
      return pointer.url ?? null;
    } catch { /* arquivo inválido: cai na coluna */ }
  }
  return columnValue ?? null;
}

export async function writeOgImage(admin: Admin, siteId: string, siteKey: string, url: string | null): Promise<string | null> {
  const body = new Blob([JSON.stringify({ url, updated_at: new Date().toISOString() })], { type: "application/json" });
  const { error } = await admin.storage.from(OG_BUCKET).upload(pointerPath(siteKey), body, { contentType: "application/json", cacheControl: "0", upsert: true });
  if (error) return error.message;
  // Melhor esforço: se o banco ainda não reconhece a coluna, o arquivo de controle já basta.
  await admin.from("site_analytics_settings").update({ og_image_url: url, updated_at: new Date().toISOString() }).eq("id", siteId);
  return null;
}
