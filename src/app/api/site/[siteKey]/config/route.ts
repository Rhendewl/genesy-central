import { NextRequest, NextResponse } from "next/server";
import { resolveSite, siteCors } from "@/lib/site-analytics";
import { pixelActive } from "@/lib/site-meta-pixel";

type Params = { params: Promise<{ siteKey: string }> };
export function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: siteCors(req) }); }

// Configuração pública lida pelo site ao carregar (apenas o que pode ficar visível no navegador).
export async function GET(req: NextRequest, { params }: Params) {
  const { siteKey } = await params;
  const { site } = await resolveSite(siteKey);
  if (!site) return NextResponse.json({ error: "Site não configurado" }, { status: 404, headers: siteCors(req) });
  return NextResponse.json(
    { meta_pixel_id: pixelActive(site) ? site.meta_pixel_id : null, og_image_url: site.og_image_url ?? null },
    { headers: { ...siteCors(req), "Cache-Control": "public, max-age=60" } },
  );
}
