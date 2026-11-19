"use client";
import Image from "next/image";
import {useCallback,useEffect,useRef,useState} from "react";
import {Loader2,MessageSquare,RefreshCw,Send} from "lucide-react";
type Note={id:string;body:string;author_auth_id:string|null;author_name:string;author_avatar:string|null;created_at:string};
function Avatar({name,url}:{name:string;url:string|null}){const [failed,setFailed]=useState(false);return <span className="lead-note-avatar">{url&&!failed?<Image unoptimized width={32} height={32} src={url} alt={name} onError={()=>setFailed(true)}/>:name.split(" ").filter(Boolean).slice(0,2).map(p=>p[0]).join("")}</span>;}
const stamp=(s:string)=>new Date(s).toLocaleString("pt-BR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});
const mergeNotes=(old:Note[],incoming:Note[])=>Array.from(new Map([...old,...incoming].map(n=>[n.id,n])).values()).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
export function LeadNotesPanel({leadId,legacyNotes,onLegacyChange,onDraftChange,onSendingChange}:{leadId:string;legacyNotes:string;onLegacyChange:(value:string)=>void;onDraftChange:(dirty:boolean)=>void;onSendingChange:(busy:boolean)=>void}){
 const [notes,setNotes]=useState<Note[]>([]),[viewer,setViewer]=useState<string|null>(null),[cursor,setCursor]=useState<string|null>(null);
 const [draft,setDraft]=useState(""),[loading,setLoading]=useState(true),[older,setOlder]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState("");
 const alive=useRef(true),initial=useRef(true),requestId=useRef(crypto.randomUUID()),sendRef=useRef(false),pane=useRef<HTMLDivElement>(null),end=useRef<HTMLDivElement>(null),scrollToEnd=useRef(true);

 const load=useCallback(async()=>{try{
  const r=await fetch(`/api/crm/leads/${leadId}/notes`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.error||"Não foi possível carregar as notas.");
  if(!alive.current)return;scrollToEnd.current=initial.current||Boolean(pane.current&&pane.current.scrollHeight-pane.current.scrollTop-pane.current.clientHeight<80);
  setNotes(n=>mergeNotes(n,j.notes));setViewer(j.viewerId);if(initial.current)setCursor(j.next);initial.current=false;setError("");
 }catch(e){if(alive.current)setError(e instanceof Error?e.message:"Não foi possível carregar as notas.");}finally{if(alive.current)setLoading(false);}},[leadId]);
 useEffect(()=>{alive.current=true;void load();const timer=setInterval(()=>{if(document.visibilityState==="visible"&&!sendRef.current)void load();},20000);return()=>{alive.current=false;clearInterval(timer);};},[load]);
 useEffect(()=>{onDraftChange(Boolean(draft.trim()));},[draft,onDraftChange]);
 useEffect(()=>{function warn(e:BeforeUnloadEvent){if(draft.trim()){e.preventDefault();e.returnValue="";}}window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[draft]);
 useEffect(()=>{if(scrollToEnd.current)end.current?.scrollIntoView?.({behavior:window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?"auto":"smooth",block:"nearest"});scrollToEnd.current=false;},[notes]);
 async function earlier(){if(!cursor||older)return;setOlder(true);const height=pane.current?.scrollHeight??0,top=pane.current?.scrollTop??0;try{const r=await fetch(`/api/crm/leads/${leadId}/notes?before=${encodeURIComponent(cursor)}`,{cache:"no-store"});const j=await r.json();if(!r.ok)throw Error(j.error);scrollToEnd.current=false;setNotes(n=>mergeNotes(n,j.notes));setCursor(j.next);requestAnimationFrame(()=>{if(pane.current)pane.current.scrollTop=pane.current.scrollHeight-height+top;});}catch{setError("Não foi possível carregar as notas anteriores.");}finally{setOlder(false);}}
 async function send(){if(!draft.trim()||sendRef.current)return;sendRef.current=true;setSending(true);onSendingChange(true);setError("");try{
  const r=await fetch(`/api/crm/leads/${leadId}/notes`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:requestId.current,body:draft.trim()})});const j=await r.json();if(!r.ok)throw Error(j.error||"Não foi possível confirmar o envio. Tente novamente.");
  scrollToEnd.current=true;setNotes(n=>mergeNotes(n,[j.note]));setDraft("");requestId.current=crypto.randomUUID();onDraftChange(false);window.dispatchEvent(new Event("crm-lead-activity-changed"));
 }catch(e){setError(e instanceof Error?e.message:"Não foi possível confirmar o envio. Tente novamente sem duplicar a nota.");}finally{sendRef.current=false;setSending(false);onSendingChange(false);}}
 return <aside className="lead-notes-panel" aria-label="Notas do lead">
  <header className="lead-notes-heading"><div><span className="lead-collab-kicker">CONTEXTO E PRÓXIMOS PASSOS</span><h3><MessageSquare size={18}/> Notas do lead <span>{notes.length}{cursor?"+":""}</span></h3></div><button type="button" onClick={()=>void load()} aria-label="Atualizar notas" disabled={loading}><RefreshCw size={15} className={loading?"animate-spin":""}/></button></header>
  <div className="lead-notes-timeline" ref={pane}>
   {cursor&&<button type="button" className="lead-notes-earlier" disabled={older} onClick={()=>void earlier()}>{older?"Carregando…":"Carregar notas anteriores"}</button>}
   {legacyNotes&&<div className="lead-legacy-note"><strong>Nota anterior</strong><p>{legacyNotes}</p><small>Este registro não possui autoria ou data disponíveis.</small></div>}
   {loading&&<div className="lead-notes-empty"><Loader2 size={20} className="animate-spin"/>Carregando histórico…</div>}
   {!loading&&!notes.length&&<div className="lead-notes-empty"><MessageSquare size={28}/><strong>A conversa sobre este lead começa aqui</strong><p>Registre o contexto de cada contato. As novas notas mostram quem escreveu e quando.</p></div>}
   {notes.map((n,i)=><div key={n.id} className={`lead-note-message ${n.author_auth_id===viewer?"is-own":""}`}>
    {(i===0||new Date(notes[i-1].created_at).toDateString()!==new Date(n.created_at).toDateString())&&<div className="lead-note-day">{new Date(n.created_at).toLocaleDateString("pt-BR",{day:"numeric",month:"long",year:"numeric"})}</div>}
    <div className="lead-note-message-row"><Avatar name={n.author_name} url={n.author_avatar}/><div className="lead-note-content"><div className="lead-note-meta"><strong>{n.author_name}{n.author_auth_id===viewer?" · você":""}</strong><time dateTime={n.created_at} title={new Date(n.created_at).toLocaleString("pt-BR")}>{stamp(n.created_at)}</time></div><p>{n.body}</p></div></div>
   </div>)}<div ref={end}/>
  </div>
  <div className="lead-note-composer">
   {error&&<p className="lead-collab-error" role="alert">{error} <button type="button" onClick={()=>void load()}>Recarregar histórico</button></p>}
   <label htmlFor="lead-new-note">Nova nota <span>{draft.trim()?"Rascunho não enviado":"Visível para quem tem acesso ao lead"}</span></label>
   <div className="lead-note-field"><textarea id="lead-new-note" rows={3} maxLength={10000} value={draft} disabled={sending} placeholder="O que aconteceu no contato? Qual é o próximo passo?" onChange={e=>{setDraft(e.target.value);requestId.current=crypto.randomUUID();}} onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"){e.preventDefault();void send();}}}/></div>
   <div className="lead-note-composer-actions"><small>Ctrl/⌘ + Enter para enviar</small><button type="button" disabled={sending||loading||!draft.trim()} onClick={()=>void send()}>{sending?<Loader2 size={14} className="animate-spin"/>:<Send size={14}/>} {sending?"Enviando…":"Enviar nota"}</button></div>
   <details className="lead-legacy-editor"><summary>Anotação geral anterior · salva automaticamente</summary><label className="sr-only" htmlFor="lead-notes">Notas anteriores</label><textarea id="lead-notes" rows={3} value={legacyNotes} onChange={e=>onLegacyChange(e.target.value)} placeholder="Anotação geral anterior"/><small>As mensagens acima possuem autoria e horário próprios. Este campo preserva a anotação antiga.</small></details>
  </div>
 </aside>;
}
