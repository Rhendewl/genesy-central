import {createHash} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {createAdminSupabaseClient} from "@/lib/supabase-admin";
import {leadContext,smallBody,collaborationError,fail,UUID,privateHeaders} from "@/lib/crm/lead-collaboration-server";
import {validateLeadReminder} from "@/lib/crm/lead-reminder-validation";
import {CalendarValidationError} from "@/lib/google-calendar/event-validation";
import {GoogleTokenService} from "@/lib/google-calendar/google-token-service";
import {createCalendarEvent,GoogleAuthError} from "@/lib/google-calendar/google-calendar-service";
type Params={params:Promise<{id:string}>};
export async function GET(_req:NextRequest,{params}:Params){try{
 const {id}=await params;const {db}=await leadContext(id);
 const {data,error}=await db.from("crm_lead_reminders").select("id,title,description,start_at,end_at,timezone,notice_minutes,notify_at,status,google_event_url,notified_at,created_at").eq("lead_id",id).in("status",["scheduled","creating","google_error","cancelling"]).order("start_at",{ascending:false}).limit(30);
 if(error)fail("Não foi possível carregar os lembretes.",500);
 return NextResponse.json({reminders:data??[]},{headers:privateHeaders});
}catch(e){return collaborationError(e);}}
export async function POST(req:NextRequest,{params}:Params){try{
 const {id}=await params;const ctx=await leadContext(id);const body=await smallBody(req);
 if(typeof body.id!=="string"||!UUID.test(body.id))fail("Identificador de tentativa inválido.");
 // Validate the immutable request first; future-time validation is required only
 // for new attempts, so a lost response can be retried after its start time.
 const admin=createAdminSupabaseClient();
 const prior=await admin.from("crm_lead_reminders").select("*").eq("id",body.id).eq("creator_auth_id",ctx.user.id).eq("lead_id",id).maybeSingle();
 if(prior.error)fail("Não foi possível verificar a tentativa.",500);
 const input=validateLeadReminder(body,prior.data?Date.parse(prior.data.created_at)-1000:Date.now());
 const payload={title:input.title,description:input.description,start:new Date(input.start).toISOString(),end:new Date(input.end).toISOString(),timezone:input.timezone,noticeMinutes:input.noticeMinutes};
 const hash=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
 const eventId=createHash("sha256").update(`crm:${ctx.user.id}:${id}:${body.id}`).digest("hex");
 if(prior.data&&prior.data.payload_hash!==hash)fail("Esta tentativa já está vinculada a outros dados. Feche e abra um novo lembrete.",409);
 if(prior.data?.status==="scheduled")return NextResponse.json({reminder:prior.data},{headers:privateHeaders});
 if(prior.data?.status==="cancelled"||prior.data?.status==="cancelling")fail("Este lembrete foi cancelado ou está sendo cancelado.",409);
 if(!prior.data){
  const inserted=await admin.from("crm_lead_reminders").insert({id:body.id,lead_id:id,owner_id:ctx.lead.user_id,creator_auth_id:ctx.user.id,recipient_profile_id:ctx.profile.id,title:input.title,description:input.description,start_at:input.start,end_at:input.end,timezone:input.timezone,notice_minutes:input.noticeMinutes,notify_at:input.notifyAt,google_event_id:eventId,payload_hash:hash});
  if(inserted.error)fail(inserted.error.code==="23505"?"Esta criação está em andamento. Tente confirmar novamente.":"Não foi possível preparar o lembrete.",inserted.error.code==="23505"?409:500);
 }
 const lease=new Date(Date.now()+120000).toISOString();
 const claim=await admin.from("crm_lead_reminders").update({status:"creating",locked_until:lease,error:null}).eq("id",body.id).eq("creator_auth_id",ctx.user.id).in("status",["creating","google_error"]).or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`).select("id").maybeSingle();
 if(claim.error)fail("Não foi possível reservar a criação.",500);if(!claim.data)fail("Criação em andamento. Aguarde até dois minutos e tente confirmar novamente.",409);
 try{
  const token=await new GoogleTokenService(ctx.db).getValidAccessToken(ctx.user.id);
  const event=await createCalendarEvent({accessToken:token,googleCalendarId:"primary",eventId,reminderId:body.id,summary:input.title,description:[input.description,`Lead no Genesy: https://dash.genesycompany.com/crm?lead=${id}`].filter(Boolean).join("\n\n"),startDateTime:input.start,endDateTime:input.end,timezone:input.timezone,reminders:input.reminders});
  const saved=await admin.from("crm_lead_reminders").update({status:"scheduled",google_event_url:event.htmlLink,locked_until:null,error:null}).eq("id",body.id).eq("creator_auth_id",ctx.user.id).eq("locked_until",lease).select("id,title,description,start_at,end_at,timezone,notice_minutes,notify_at,status,google_event_url,notified_at,created_at").single();
  if(saved.error)throw new Error("Confirmation pending");
  return NextResponse.json({reminder:saved.data},{status:201,headers:privateHeaders});
 }catch(e){
  await admin.from("crm_lead_reminders").update({status:"google_error",locked_until:null,error:"Criação não confirmada"}).eq("id",body.id).eq("locked_until",lease);
  if(e instanceof GoogleAuthError)return NextResponse.json({error:"Conecte ou reconecte sua conta Google para criar este lembrete.",reconnect:true},{status:409,headers:privateHeaders});
  fail("Não foi possível confirmar o lembrete. Tente confirmar novamente; esta tentativa não cria eventos duplicados.",502);
 }
}catch(e){if(e instanceof CalendarValidationError)return NextResponse.json({error:e.message},{status:400});return collaborationError(e);}}
