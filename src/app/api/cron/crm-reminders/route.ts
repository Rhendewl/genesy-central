import {createHash,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {createAdminSupabaseClient} from "@/lib/supabase-admin";
import {dispatchPushToUser} from "@/lib/notifications/push-dispatcher";
export const maxDuration=60;
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
 const received=req.headers.get("x-cron-secret")??req.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
 const expected=process.env.INSTAGRAM_SCHEDULER_SECRET_SHA256;
 const hash=createHash("sha256").update(received??"").digest("hex");
 const authorized=received&&((expected&&/^[a-f0-9]{64}$/.test(expected)&&timingSafeEqual(Buffer.from(hash),Buffer.from(expected)))||(process.env.CRON_SECRET&&received===process.env.CRON_SECRET));
 if(!authorized)return NextResponse.json({error:"Não autorizado"},{status:401});
 const db=createAdminSupabaseClient();const due=await db.rpc("deliver_due_crm_reminders");
 if(due.error)return NextResponse.json({error:"Não foi possível processar os lembretes"},{status:500});
 const pending=await db.from("workflow_notifications").select("id,recipient_user_id,user_id,title,body,action_url,event_id").eq("source","crm_lead_reminder").is("push_attempted_at",null).order("created_at").limit(10);
 if(pending.error)return NextResponse.json({error:"Não foi possível consultar os avisos"},{status:500});
 let attempted=0;
 for(const n of pending.data??[]){
  const claim=await db.from("workflow_notifications").update({push_attempted_at:new Date().toISOString(),push_status:"processing"}).eq("id",n.id).is("push_attempted_at",null).select("id").maybeSingle();if(claim.error||!claim.data)continue;
  attempted++;
  try{
   const recipient=await db.from("user_profiles").select("auth_user_id").eq("id",n.recipient_user_id).eq("owner_id",n.user_id).eq("is_active",true).maybeSingle();
   if(recipient.error||!recipient.data?.auth_user_id)throw new Error("Recipient inactive");
   const result=await dispatchPushToUser(db,recipient.data.auth_user_id,n.title,n.body,{url:n.action_url,tag:n.event_id});
   await db.from("workflow_notifications").update({push_status:result.skippedReason??(result.failed?"partial":"accepted"),push_subscriptions:result.subscriptions,push_accepted:result.accepted,push_failed:result.failed,push_removed:result.removed,push_error:result.skippedReason??null}).eq("id",n.id);
  }catch{await db.from("workflow_notifications").update({push_status:"failed",push_error:"Push não confirmado; aviso disponível na central"}).eq("id",n.id);}
 }
 return NextResponse.json({delivered:due.data,attempted});
}
