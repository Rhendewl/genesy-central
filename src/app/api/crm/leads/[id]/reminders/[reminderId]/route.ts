import {NextRequest,NextResponse} from "next/server";
import {createAdminSupabaseClient} from "@/lib/supabase-admin";
import {leadContext,collaborationError,fail,UUID,privateHeaders} from "@/lib/crm/lead-collaboration-server";
import {GoogleTokenService} from "@/lib/google-calendar/google-token-service";
import {deleteCalendarEvent,GoogleAuthError} from "@/lib/google-calendar/google-calendar-service";
export async function DELETE(_req:NextRequest,{params}:{params:Promise<{id:string;reminderId:string}>}){try{
 const {id,reminderId}=await params;const ctx=await leadContext(id);if(!UUID.test(reminderId))fail("Lembrete inválido.");
 const admin=createAdminSupabaseClient();const row=await admin.from("crm_lead_reminders").select("*").eq("id",reminderId).eq("lead_id",id).eq("creator_auth_id",ctx.user.id).maybeSingle();
 if(row.error||!row.data)fail("Lembrete não encontrado.",404);if(row.data.status==="cancelled")return NextResponse.json({ok:true});
 const lease=new Date(Date.now()+120000).toISOString();
 const claim=await admin.from("crm_lead_reminders").update({status:"cancelling",locked_until:lease}).eq("id",reminderId).eq("creator_auth_id",ctx.user.id).or(`locked_until.is.null,locked_until.lt.${new Date().toISOString()}`).select("id").maybeSingle();
 if(claim.error||!claim.data)fail("Este lembrete está em processamento. Tente novamente em instantes.",409);
 try{
  const token=await new GoogleTokenService(ctx.db).getValidAccessToken(ctx.user.id);await deleteCalendarEvent(token,"primary",row.data.google_event_id);
  const saved=await admin.from("crm_lead_reminders").update({status:"cancelled",locked_until:null}).eq("id",reminderId).eq("locked_until",lease);
  if(saved.error)throw new Error("Cancellation pending");return NextResponse.json({ok:true},{headers:privateHeaders});
 }catch(e){await admin.from("crm_lead_reminders").update({status:row.data.status,locked_until:null}).eq("id",reminderId).eq("locked_until",lease);if(e instanceof GoogleAuthError)fail("Reconecte o Google Agenda antes de cancelar.",409);fail("Não foi possível confirmar o cancelamento. Tente novamente.",502);}
}catch(e){return collaborationError(e);}}
