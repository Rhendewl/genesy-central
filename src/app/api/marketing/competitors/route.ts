import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getMarketingServerContext, apiError } from "@/lib/marketing/server";
import { assertMarketingAccess } from "@/lib/marketing/instagram-access";
import { discoveryIssue } from "@/lib/marketing/discovery-error";
import { discoveryReady } from "@/lib/marketing/competitor-discovery";
import {
  competitorUsernameInput,
  rankPosts,
  safeMediaPreview,
  type CompetitorPost,
} from "@/lib/marketing/competitor-domain";
import { syncCompetitor } from "@/lib/marketing/competitor-sync";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const failure = (error: unknown) => {
  const parsed = apiError(error);
  return NextResponse.json(
    {
      error:
        parsed.status === 500
          ? "Não foi possível acessar a inteligência de concorrentes. Verifique a migração e a configuração do servidor."
          : parsed.message,
      ...discoveryIssue(error),
    },
    { status: parsed.status },
  );
};
export async function GET(req: NextRequest) {
  try {
    const db = await createServerSupabaseClient();
    const ctx = await getMarketingServerContext(db);
    assertMarketingAccess(ctx, "marketing.concorrentes");
    const days = Number(req.nextUrl.searchParams.get("days") ?? 30);
    if (![30, 60, 90].includes(days))
      throw Object.assign(new Error("Período inválido"), { status: 400 });
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const [profiles, posts] = await Promise.all([
      db
        .from("marketing_competitors")
        .select("*")
        .eq("organization_id", ctx.organizationId)
        .order("created_at"),
      db
        .from("marketing_competitor_posts")
        .select("*")
        .eq("organization_id", ctx.organizationId)
        .gte("published_at", since)
        .order("published_at", { ascending: false })
        .limit(1000),
    ]);
    for (const r of [profiles, posts])
      if (r.error) throw new Error(r.error.message);
    // Latest observation already stores its public media previews in JSON. No
    // additional Meta calls or schema changes are needed to display the gallery.
    const previews = new Map<string, string>();
    await Promise.all((profiles.data ?? []).map(async (p: {id: string}) => {
      const latest = await db.from("marketing_competitor_snapshots")
        .select("posts").eq("organization_id", ctx.organizationId).eq("profile_id", p.id)
        .order("collected_at", { ascending: false }).limit(1);
      // Missing preview is non-fatal: metrics remain available independently.
      if (latest.error) return;
      for (const item of latest.data?.[0]?.posts ?? []) {
        const url = safeMediaPreview(item.preview_url);
        if (typeof item.id === "string" && url) previews.set(`${p.id}:${item.id}`, url);
      }
    }));
    let history: unknown[] = [];
    const profileId = req.nextUrl.searchParams.get("profile");
    if (profileId) {
      if (!/^[0-9a-f-]{36}$/i.test(profileId))
        throw Object.assign(new Error("Perfil inválido"), { status: 400 });
      const result = await db
        .from("marketing_competitor_snapshots")
        .select("id,profile_id,collected_at,followers_count,media_count,posts")
        .eq("organization_id", ctx.organizationId)
        .eq("profile_id", profileId)
        .order("collected_at", { ascending: false })
        .limit(30);
      if (result.error) throw new Error(result.error.message);
      history = result.data ?? [];
    }
    return NextResponse.json(
      {
        profiles: profiles.data,
        posts: rankPosts(((posts.data ?? []) as CompetitorPost[]).map(p => ({ ...p, preview_url: previews.get(`${p.profile_id}:${p.id}`) ?? null }))),
        history,
        truncated: posts.data?.length === 1000,
        isAdmin: ctx.isAdmin,
        configured: discoveryReady(ctx.organizationId),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req: NextRequest) {
  try {
    const session = await createServerSupabaseClient();
    const ctx = await getMarketingServerContext(session);
    assertMarketingAccess(ctx, "marketing.concorrentes");
    if (!ctx.isAdmin)
      throw Object.assign(
        new Error("Apenas administradores podem gerenciar concorrentes."),
        { status: 403 },
      );
    if (Number(req.headers.get("content-length") ?? 0) > 4096)
      throw Object.assign(new Error("Requisição muito grande"), {
        status: 413,
      });
    const body = await req.json().catch(() => null);
    if (!body || !["add", "sync", "toggle", "delete"].includes(body.action))
      throw Object.assign(new Error("Ação inválida"), { status: 400 });
    const db = createAdminSupabaseClient();
    if (body.action === "add") {
      const username = competitorUsernameInput(body.username);
      const { data:created,error } = await db.from("marketing_competitors")
        .insert({ organization_id:ctx.organizationId,username }).select("id,username").single();
      if(error)throw Object.assign(new Error(error.code==="23505"?"Este perfil já está cadastrado. Selecione o card dele para analisar ou coletar.":error.code==="P0001"?"Limite de 20 perfis por organização atingido.":"Não foi possível cadastrar o perfil."),{status:409});
      let collection:Record<string,unknown>|null=null;
      if(body.collect===true){
        try{collection={success:true,...await syncCompetitor(db,ctx.organizationId,created.id)};}
        catch(e){collection={success:false,error:apiError(e).status===500?"Coleta não confirmada. O perfil foi cadastrado e pode ser consultado novamente pela próxima janela.":apiError(e).message,...discoveryIssue(e)};}
      }
      return NextResponse.json({success:true,profile:created,collection},{status:201});
    }
    if (typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id))
      throw Object.assign(new Error("Perfil inválido"), { status: 400 });
    const { data: profile, error } = await db
      .from("marketing_competitors")
      .select("*")
      .eq("organization_id", ctx.organizationId)
      .eq("id", body.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!profile)
      throw Object.assign(new Error("Perfil não encontrado"), { status: 404 });
    if (body.action === "sync")
      return NextResponse.json(
        await syncCompetitor(db, ctx.organizationId, profile.id),
      );
    if (body.action === "toggle" && typeof body.active !== "boolean")
      throw Object.assign(new Error("Estado inválido"), { status: 400 });
    const result =
      body.action === "delete"
        ? await db
            .from("marketing_competitors")
            .delete()
            .eq("id", profile.id)
            .eq("organization_id", ctx.organizationId)
        : await db
            .from("marketing_competitors")
            .update({ active: body.active })
            .eq("id", profile.id)
            .eq("organization_id", ctx.organizationId);
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
