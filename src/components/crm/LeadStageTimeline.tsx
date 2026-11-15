"use client";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { analyzeOperation, CRM_TIME_ZONE, durationLabel, formatArrival, type TimingEvent, type TimingStage } from "@/lib/crm/operation-analytics";
import type { Lead } from "@/types";

export function LeadStageTimeline({ lead }: { lead: Lead }) {
  const [history, setHistory] = useState<TimingEvent[]>([]);
  const [stages, setStages] = useState<TimingStage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now);
  const [version, setVersion] = useState(0);
  useEffect(() => { const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer); }, []);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      const db = getSupabaseClient();
      const events: TimingEvent[] = [];
      try {
        for (let offset=0;;offset+=500) {
          const result=await db.from("crm_lead_stage_history").select("*").eq("lead_id",lead.id).order("moved_at").order("id").range(offset,offset+499);
          if(result.error)throw result.error;
          events.push(...(result.data??[]));if((result.data?.length??0)<500)break;
        }
        const result=await db.from("crm_stages").select("*").eq("pipeline_id",lead.pipeline_id??"");
        if(result.error)throw result.error;
        if(!cancelled){setHistory(events);setStages(result.data??[]);}
      } catch { if(!cancelled)setError("Não foi possível carregar as movimentações."); }
      finally {if(!cancelled)setLoading(false);}
    }
    void load(); return()=>{cancelled=true;};
  },[lead.id,lead.pipeline_id,lead.stage_id,version]);
  const timing=useMemo(()=>analyzeOperation([lead],history,stages,now).timings[0],[lead,history,stages,now]);
  const name=(id:string)=>stages.find(stage=>stage.id===id)?.name??"Etapa removida";
  const timestamp=(at:string)=>new Intl.DateTimeFormat("pt-BR",{timeZone:CRM_TIME_ZONE,dateStyle:"short",timeStyle:"short"}).format(new Date(at));
  return <details className="rounded-xl border border-[var(--border)] bg-[var(--input)] p-3">
    <summary className="cursor-pointer text-xs font-medium text-[var(--text-title)]">Movimentações e tempo por etapa</summary>
    <div className="mt-3 space-y-3 text-xs text-[var(--text-body)]">
      <p>Chegada: {formatArrival(lead)}</p>
      <p>Primeiro avanço de atendimento: {timing.firstAdvanceAt?timestamp(timing.firstAdvanceAt):"Sem avanço registrado"} {timing.firstAdvanceMs!==null&&`· ${durationLabel(timing.firstAdvanceMs)} após a chegada`}</p>
      <p className="text-[var(--muted-foreground)]">Horário de João Pessoa. O avanço é um indicador operacional; não confirma uma conversa com o cliente.</p>
      {loading?<p>Carregando histórico…</p>:error?<p role="alert">{error}</p>:<>
        {timing.visits.map((visit,index)=><div key={`${visit.stageId}-${index}`} className="border-t border-[var(--border)] pt-3"><p className="font-medium">{name(visit.stageId)} · {durationLabel(visit.durationMs)}{visit.exitedAt?" até sair":" em aberto"}</p><p className="mt-1 text-[var(--muted-foreground)]">{timestamp(visit.enteredAt)} → {visit.exitedAt?timestamp(visit.exitedAt):"agora"}</p></div>)}
        {timing.transitions.length>0&&<div className="border-t border-[var(--border)] pt-3"><p className="mb-2 font-medium">Registro dos movimentos</p>{timing.transitions.map((event,index)=><p key={index} className="mb-2 text-[var(--muted-foreground)]">{timestamp(event.at)} · {name(event.from)} → {name(event.to)}</p>)}</div>}
        {!timing.visits.length&&!timing.transitions.length&&<p>Sem passagens com horário conhecido. Cadastros anteriores não recebem horários estimados.</p>}
      </>}
      <button type="button" onClick={()=>{setNow(Date.now());setVersion(v=>v+1);}} className="min-h-9 underline">Atualizar histórico</button>
    </div>
  </details>;
}
