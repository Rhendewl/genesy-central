import { NextRequest, NextResponse } from "next/server";
import { resolveSite, siteCors } from "@/lib/site-analytics";
import { pixelActive } from "@/lib/site-meta-pixel";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { readOgImage } from "@/lib/site-og-image";

type Params = { params: Promise<{ siteKey: string }> };
export function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: siteCors(req) }); }

// Configuração pública lida pelo site ao carregar (apenas o que pode ficar visível no navegador).
export async function GET(req: NextRequest, { params }: Params) {
  const { siteKey } = await params;
  const { site } = await resolveSite(siteKey);
  if (!site) return NextResponse.json({ error: "Site não configurado" }, { status: 404, headers: siteCors(req) });
  const ogImage = await readOgImage(createAdminSupabaseClient(), site.site_key ?? siteKey, site.og_image_url);
  return NextResponse.json(
    { meta_pixel_id: pixelActive(site) ? site.meta_pixel_id : null, og_image_url: ogImage },
    { headers: { ...siteCors(req), "Cache-Control": "public, max-age=60" } },
  );
}
