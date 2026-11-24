import { NextRequest, NextResponse } from "next/server";
import { siteAnalyticsContext } from "@/lib/site-analytics-auth";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { siteKeyParam } from "@/lib/site-analytics";
import { OG_BUCKET as BUCKET, writeOgImage } from "@/lib/site-og-image";

// Banner de visualização do link (og:image) de cada site/página do módulo Site Genesy.
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 3 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!context.canManage) return NextResponse.json({ error: "Apenas administradores podem alterar o banner" }, { status: 403 });
  const siteKey = siteKeyParam(req.nextUrl.searchParams.get("site"));
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "Envie uma imagem" }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Use uma imagem JPG, PNG ou WebP" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "A imagem precisa ter até 3 MB" }, { status: 400 });

  const admin = createAdminSupabaseClient();
  const { data: site } = await admin.from("site_analytics_settings").select("id").eq("user_id", context.ownerId).eq("site_key", siteKey).maybeSingle();
  if (!site) return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });

  // Um arquivo novo a cada troca: o endereço muda e WhatsApp/Instagram buscam a imagem nova.
  const path = `og/${siteKey}/${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (uploadError) return NextResponse.json({ error: `Não foi possível enviar a imagem: ${uploadError.message}` }, { status: 500 });
  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const error = await writeOgImage(admin, site.id, siteKey, publicData.publicUrl);
  if (error) return NextResponse.json({ error: `Não foi possível salvar o banner: ${error}` }, { status: 500 });
  return NextResponse.json({ ok: true, url: publicData.publicUrl });
}

// Volta para a imagem padrão do site.
export async function DELETE(req: NextRequest) {
  const context = await siteAnalyticsContext();
  if (!context) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!context.canManage) return NextResponse.json({ error: "Apenas administradores podem alterar o banner" }, { status: 403 });
  const siteKey = siteKeyParam(req.nextUrl.searchParams.get("site"));
  const admin = createAdminSupabaseClient();
  const { data: site } = await admin.from("site_analytics_settings").select("id").eq("user_id", context.ownerId).eq("site_key", siteKey).maybeSingle();
  if (!site) return NextResponse.json({ error: "Página não encontrada" }, { status: 404 });
  const error = await writeOgImage(admin, site.id, siteKey, null);
  if (error) return NextResponse.json({ error: `Não foi possível restaurar: ${error}` }, { status: 500 });
  return NextResponse.json({ ok: true });
}
