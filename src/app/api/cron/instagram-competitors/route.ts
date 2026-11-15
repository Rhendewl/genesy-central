import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { syncCompetitor } from "@/lib/marketing/competitor-sync";
import { DiscoveryError,discoveryIssue } from "@/lib/marketing/discovery-error";
import { discover,discoveryReady } from "@/lib/marketing/competitor-discovery";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const received =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expectedHash = process.env.INSTAGRAM_SCHEDULER_SECRET_SHA256;
  const receivedHash = createHash("sha256")
    .update(received ?? "")
    .digest("hex");
  const vaultAuthorized = Boolean(
    received &&
    expectedHash &&
    /^[a-f0-9]{64}$/.test(expectedHash) &&
    timingSafeEqual(Buffer.from(expectedHash), Buffer.from(receivedHash)),
  );
  if (
    !vaultAuthorized &&
    (!process.env.CRON_SECRET || received !== process.env.CRON_SECRET)
  )
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const org = process.env.META_DISCOVERY_ORGANIZATION_ID;
  if (!org || !discoveryReady(org))
    return NextResponse.json(
      { skipped: true, reason: "Business Discovery não configurado" },
      { status: 200 },
    );
  const db = createAdminSupabaseClient();
  const diagnosticId=req.nextUrl.searchParams.get("diagnose");
  if(diagnosticId){
    if(!/^[0-9a-f-]{36}$/i.test(diagnosticId))return NextResponse.json({error:"Perfil inválido"},{status:400});
    const target=await db.from("marketing_competitors").select("username").eq("organization_id",org).eq("id",diagnosticId).maybeSingle();
    if(target.error||!target.data)return NextResponse.json({error:"Perfil não encontrado"},{status:404});
    try{const observed=await discover(org,target.data.username);return NextResponse.json({diagnostic:true,available:true,username:observed.username,publicPosts:observed.posts.length},{headers:{"Cache-Control":"no-store"}});}
    catch(e){return NextResponse.json({diagnostic:true,available:false,error:e instanceof DiscoveryError?e.message:"Diagnóstico não concluído",...discoveryIssue(e),detail:e instanceof DiscoveryError?e.diagnostic:undefined},{headers:{"Cache-Control":"no-store"}});}
  }
  const { data, error } = await db
    .from("marketing_competitors")
    .select("id")
    .eq("organization_id", org)
    .eq("active", true)
    .lte("next_sync_at", new Date().toISOString())
    .order("next_sync_at")
    .limit(2);
  if (error)
    return NextResponse.json(
      { error: "Falha ao consultar perfis" },
      { status: 500 },
    );
  const results = [];
  for (const row of data ?? []) {
    try {
      results.push({
        id: row.id,
        success: true,
        ...(await syncCompetitor(db, org, row.id)),
      });
    } catch (error) {
      results.push({ id: row.id, success: false });
      if (
        typeof error === "object" &&
        error &&
        "status" in error &&
        error.status === 429
      )
        break;
    }
  }
  return NextResponse.json({ results });
}

export const POST = GET;
