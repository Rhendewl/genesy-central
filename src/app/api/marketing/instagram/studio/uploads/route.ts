import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/marketing/server";
import { signState } from "@/lib/crypto";
import { studioAccount, studioContext, studioFail } from "@/lib/marketing/instagram-studio-server";
import { validateStudioAssets } from "@/lib/marketing/instagram-studio";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const { ctx, db } = await studioContext();
    const body = await req.json();
    const assets: unknown = body.assets;
    validateStudioAssets(body.format, assets);
    await studioAccount(db, ctx.organizationId, String(body.connectionId ?? ""));
    const id = crypto.randomUUID();
    const prefix = `marketing/${ctx.organizationId}/instagram-studio/${id}`;
    const manifests = assets.map((asset, index) => ({ ...asset, path: `${prefix}/${index}.${asset.type === "video/mp4" ? "mp4" : asset.type === "video/quicktime" ? "mov" : "jpg"}` }));
    const previewPath = `${prefix}/preview.jpg`;
    if (!Number.isInteger(body.previewSize) || body.previewSize < 1 || body.previewSize > 3 * 1024 * 1024) throw studioFail("Prévia inválida.");
    const uploads = await Promise.all([...manifests.map(asset => ({ path: asset.path, type: asset.type })), { path: previewPath, type: "image/jpeg" }].map(async asset => {
      const signed = await db.storage.from("criativos").createSignedUploadUrl(asset.path);
      if (signed.error) throw signed.error;
      return { ...asset, token: signed.data.token };
    }));
    return NextResponse.json({ id, uploads, ticket: signState({ purpose: "instagram-studio", id, organizationId: ctx.organizationId, userId: ctx.user.id,
      connectionId: body.connectionId, format: body.format, ratio: body.ratio === "portrait" || body.ratio === "landscape" ? body.ratio : "square", assets: manifests, previewPath, previewSize: body.previewSize }) });
  } catch (error) { const e = apiError(error); return NextResponse.json({ error: e.message }, { status: e.status }); }
}
