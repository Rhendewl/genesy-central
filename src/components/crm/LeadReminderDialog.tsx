"use client";
import {useEffect,useRef,useState} from "react";
import {Bell,CalendarClock,Check,ExternalLink,Loader2} from "lucide-react";
import {format,addMinutes} from "date-fns";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import {useModalOpen} from "@/hooks/useModalOpen";
import {invalidateGoogleCalendarEvents} from "@/hooks/useGoogleCalendarEvents";
import {LeadScheduleFields} from "./LeadScheduleFields";
export type LeadReminder={id:string;title:string;description:string;start_at:string;end_at:string;timezone:string;notice_minutes:number;notify_at:string;status:string;google_event_url:string|null;notified_at:string|null};
export const googleEventLink=(value:string|null)=>{try{const u=new URL(value??"");return u.protocol==="https:"&&["www.google.com","calendar.google.com"].includes(u.hostname)?u.href:null;}catch{return null;}};
export function LeadReminderDialog({leadId,leadName,pending,onClose,onCreated}:{leadId:string;leadName:string;pending?:LeadReminder|null;onClose:()=>void;onCreated:()=>void}){
 useModalOpen(true);
 const [start,setStart]=useState(()=>pending?new Intl.DateTimeFormat("sv-SE",{timeZone:pending.timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(pending.start_at)).replace(" ","T"):format(addMinutes(new Date(),60),"yyyy-MM-dd'T'HH:mm"));
 const [title,setTitle]=useState(pending?.title??`Falar com ${leadName}`),[description,setDescription]=useState(pending?.description??"");
 const [duration,setDuration]=useState(pending?String((Date.parse(pending.end_at)-Date.parse(pending.start_at))/60000):"15"),[notice,setNotice]=useState(pending?.notice_minutes??10);
 const [timezone]=useState(pending?.timezone??Intl.DateTimeFormat().resolvedOptions().timeZone??"America/Fortaleza");
 const [connection,setConnection]=useState<{connected:boolean;email?:string}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const id=useRef(pending?.id??crypto.randomUUID()),saving=useRef(false),[submitted,setSubmitted]=useState(Boolean(pending));
 const [lockedDraft,setLockedDraft]=useState(Boolean(pending));
 useEffect(()=>{let live=true;const check=()=>{fetch("/api/google-calendar/status",{cache:"no-store"}).then(r=>r.json()).then(j=>{if(live)setConnection({connected:Boolean(j.connected),email:j.connection?.google_account_email});}).catch(()=>{if(live)setConnection({connected:false});});};check();window.addEventListener("focus",check);return()=>{live=false;window.removeEventListener("focus",check);};},[]);
 const noticeAt=pending?new Date(pending.notify_at):Number.isFinite(Date.parse(start))?new Date(Date.parse(start)-notice*60000):null;
 async function submit(e:React.FormEvent){e.preventDefault();if(saving.current)return;setError("");saving.current=true;setBusy(true);setSubmitted(true);
 try{
  const stamp=new Date(pending?.start_at??start);if(!Number.isFinite(stamp.getTime()))throw Error("Informe uma data e horário válidos.");
  setLockedDraft(true);
  const r=await fetch(`/api/crm/leads/${leadId}/reminders`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:id.current,title,description,start:stamp.toISOString(),end:pending?new Date(pending.end_at).toISOString():addMinutes(stamp,Number(duration)).toISOString(),timezone,noticeMinutes:notice})});const j=await r.json();if(!r.ok){if(r.status===400)setLockedDraft(Boolean(pending));if(j.reconnect)setConnection({connected:false});throw Error(j.error||"Não foi possível confirmar o lembrete.");}
  invalidateGoogleCalendarEvents();onCreated();onClose();
 }catch(e){setError(e instanceof Error?e.message:"Não foi possível confirmar. Tente novamente usando esta mesma tentativa.");}finally{saving.current=false;setBusy(false);}}
 return <Dialog open onOpenChange={open=>{if(!open&&!saving.current)onClose();}}><DialogContent className="lead-reminder-dialog !z-[90] sm:!max-w-xl" overlayClassName="!z-[80]" showCloseButton={!busy}>
  <div className="lead-reminder-icon"><CalendarClock size={24}/></div><DialogTitle>{pending?"Confirmar lembrete pendente":"Criar lembrete no lead"}</DialogTitle><DialogDescription>Reserve um horário no seu Google Agenda e receba um aviso na central de notificações do Genesy.</DialogDescription>
  <div className="lead-google-status"><span className={connection?.connected?"is-connected":""}/>{connection===null?"Conferindo Google Agenda…":connection.connected?`Google conectado${connection.email?` · ${connection.email}`:""}`:"Google Agenda desconectado"}{connection?.connected&&<Check size={14}/>}</div>
  <form onSubmit={submit} className="lead-reminder-form"><fieldset disabled={busy||lockedDraft}>
   <label>Título do lembrete<input required maxLength={240} value={title} onChange={e=>{setTitle(e.target.value);if(!submitted)id.current=crypto.randomUUID();}}/></label>
   <LeadScheduleFields value={start} onChange={setStart} disabled={busy||lockedDraft}/><div className="lead-reminder-fields"><label>Duração<select value={duration} onChange={e=>setDuration(e.target.value)}>{[15,30,45,60,90].map(n=><option key={n} value={n}>{n} minutos</option>)}{pending&&![15,30,45,60,90].includes(Number(duration))&&<option value={duration}>{duration} minutos</option>}</select></label></div>
   <label><span><Bell size={14}/> Quando avisar</span><select value={notice} onChange={e=>setNotice(Number(e.target.value))}>{[[0,"No horário"],[5,"5 minutos antes"],[10,"10 minutos antes"],[15,"15 minutos antes"],[30,"30 minutos antes"],[60,"1 hora antes"],[1440,"1 dia antes"]].map(([n,label])=><option key={n} value={n}>{label}</option>)}</select></label>
   <label>Contexto para retomar o contato<textarea maxLength={4000} rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: Retomar proposta e confirmar disponibilidade."/></label>
  </fieldset>
  <div className="lead-reminder-summary"><Bell size={16}/><div><strong>Aviso no Google + central do Genesy</strong><p>{noticeAt?`Avisar em ${noticeAt.toLocaleString("pt-BR",{timeZone:timezone})} · ${timezone}`:"Escolha a data e hora."}</p><small>O aviso do app é processado a cada minuto. Notificações no dispositivo dependem da ativação no app. O evento é pessoal, sem convite automático ao lead.</small></div></div>
  {submitted&&error&&<p className="lead-reminder-retry-hint">Esta tentativa tem um identificador próprio para evitar eventos duplicados. Mantenha os mesmos dados ao tentar confirmar novamente.</p>}
  {error&&<p role="alert" className="lead-collab-error">{error}</p>}
  {connection&&!connection.connected&&<a className="lead-google-connect" href="/api/google-calendar/connect" target="_blank" rel="noopener noreferrer">Conectar Google Agenda <ExternalLink size={13}/></a>}
  <div className="lead-reminder-actions"><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" disabled={busy||!connection?.connected}>{busy?<Loader2 size={15} className="animate-spin"/>:<CalendarClock size={15}/>} {busy?"Criando…":submitted?"Confirmar lembrete":"Criar lembrete"}</button></div>
  </form>
 </DialogContent></Dialog>;
}
