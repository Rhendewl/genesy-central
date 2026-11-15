import {NextRequest,NextResponse} from "next/server";
import {createAdminSupabaseClient} from "@/lib/supabase-admin";
import {leadContext,smallBody,collaborationError,fail,UUID,privateHeaders,safeAvatar} from "@/lib/crm/lead-collaboration-server";
type Params={params:Promise<{id:string}>};
export async function GET(req:NextRequest,{params}:Params){try{
 const {id}=await params;const {db,user}=await leadContext(id);
 let q=db.from("crm_lead_notes").select("id,body,author_auth_id,author_name,author_avatar,created_at").eq("lead_id",id).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(51);
 const before=req.nextUrl.searchParams.get("before");
 if(before){const [stamp,cursorId]=before.split("|");if(!UUID.test(cursorId??"")||!stamp||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(stamp)||!Number.isFinite(Date.parse(stamp)))fail("Página inválida.");const date=stamp;q=q.or(`created_at.lt.${date},and(created_at.eq.${date},id.lt.${cursorId})`);}
 const {data,error}=await q;if(error)fail("Não foi possível carregar as notas.",500);
 const rows=(data??[]).slice(0,50);const last=rows.at(-1);
 return NextResponse.json({notes:rows.reverse(),viewerId:user.id,next:(data?.length??0)>50&&last?`${last.created_at}|${last.id}`:null},{headers:privateHeaders});
}catch(e){return collaborationError(e);}}
export async function POST(req:NextRequest,{params}:Params){try{
 const {id}=await params;const ctx=await leadContext(id);const body=await smallBody(req);
 if(!body||typeof body.id!=="string"||!UUID.test(body.id)||typeof body.body!=="string"||!body.body.trim()||body.body.length>10000)fail("Escreva uma nota de até 10.000 caracteres.");
 const admin=createAdminSupabaseClient();const text=(body.body as string).trim();
 const row={id:body.id,lead_id:id,owner_id:ctx.lead.user_id,author_auth_id:ctx.user.id,author_profile_id:ctx.profile.id,author_name:ctx.profile.full_name||"Usuário",author_avatar:safeAvatar(ctx.profile.avatar_url),body:text};
 const result=await admin.from("crm_lead_notes").insert(row).select("id,body,author_auth_id,author_name,author_avatar,created_at").single();
 if(result.error?.code==="23505"){
  const existing=await admin.from("crm_lead_notes").select("id,body,author_auth_id,author_name,author_avatar,created_at").eq("id",body.id).eq("lead_id",id).eq("author_auth_id",ctx.user.id).maybeSingle();
  if(existing.error||!existing.data||existing.data.body!==text)fail("Esta tentativa já foi usada para outra nota. Recarregue o histórico.",409);
  return NextResponse.json({note:existing.data},{headers:privateHeaders});
 }
 if(result.error)fail("Não foi possível registrar a nota.",500);
 return NextResponse.json({note:result.data},{status:201,headers:privateHeaders});
}catch(e){return collaborationError(e);}}
