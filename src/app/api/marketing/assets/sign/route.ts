import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";

const ALLOWED = new Set(["image/png","image/jpeg","image/webp","image/svg+xml","video/mp4","video/webm","application/pdf","application/zip","application/vnd.openxmlformats-officedocument.presentationml.presentation"]);
const MAX_SIZE = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const body = await req.json().catch(() => null) as { file_name?: string; mime_type?: string; file_size?: number } | null;
    if (!body?.file_name || !body.mime_type || !ALLOWED.has(body.mime_type) || !body.file_size || body.file_size > MAX_SIZE) throw Object.assign(new Error("Arquivo inválido ou maior que 50 MB"), { status: 400 });
    const ext = body.file_name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const storagePath = `marketing/${context.organizationId}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage.from("criativos").createSignedUploadUrl(storagePath);
    if (error) throw new Error(error.message);
    const { data: { publicUrl } } = supabase.storage.from("criativos").getPublicUrl(storagePath);
    return NextResponse.json({ signed_url: data.signedUrl, storage_path: storagePath, public_url: publicUrl });
  } catch (error) { const parsed = apiError(error); return NextResponse.json({ error: parsed.message }, { status: parsed.status }); }
}
