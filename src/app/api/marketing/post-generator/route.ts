import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { apiError, getMarketingServerContext } from "@/lib/marketing/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { PostTemplate } from "@/lib/marketing/post-generator";

const BUCKET = "criativos";
const MAX_PROJECT_SIZE = 45 * 1024 * 1024;

function parseTemplate(value: unknown): PostTemplate {
  if (value !== "tweet" && value !== "stories") {
    throw Object.assign(new Error("Modelo do projeto inválido"), { status: 400 });
  }
  return value;
}

function projectLocation(organizationId: string, template: PostTemplate) {
  const prefix = `marketing/${organizationId}/post-generator`;
  // O bucket de criativos aceita somente arquivos de imagem. O projeto continua
  // sendo JSON, mas usa um contêiner permitido para aproveitar o mesmo storage.
  const filename = `${template}.project.png`;
  return { prefix, filename, path: `${prefix}/${filename}` };
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const template = parseTemplate(req.nextUrl.searchParams.get("template"));
    const known = req.nextUrl.searchParams.get("known");
    const location = projectLocation(context.organizationId, template);
    const admin = createAdminSupabaseClient();
    const { data: files, error: listError } = await admin.storage.from(BUCKET).list(location.prefix, {
      limit: 10,
      search: location.filename,
    });
    if (listError) throw new Error(listError.message);
    const file = files?.find((item) => item.name === location.filename);
    if (!file) {
      return NextResponse.json({ exists: false, storageUpdatedAt: null, signedUrl: null }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    const storageUpdatedAt = file.updated_at ?? file.created_at ?? null;
    if (known && storageUpdatedAt === known) {
      return NextResponse.json({ exists: true, storageUpdatedAt, signedUrl: null }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    const { data: signed, error: signedError } = await admin.storage.from(BUCKET).createSignedUrl(location.path, 60);
    if (signedError) throw new Error(signedError.message);
    return NextResponse.json({ exists: true, storageUpdatedAt, signedUrl: signed.signedUrl }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  try {
    const context = await getMarketingServerContext(supabase);
    const body = await req.json().catch(() => null) as { template?: unknown; fileSize?: unknown } | null;
    const template = parseTemplate(body?.template);
    const fileSize = Number(body?.fileSize);
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_PROJECT_SIZE) {
      throw Object.assign(new Error("Projeto inválido ou maior que 45 MB"), { status: 400 });
    }
    const location = projectLocation(context.organizationId, template);
    const admin = createAdminSupabaseClient();
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(location.path, { upsert: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({ path: data.path, token: data.token }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const parsed = apiError(error);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }
}
