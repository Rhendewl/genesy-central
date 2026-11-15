import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { Lead } from "@/types";
import type { TimingStage } from "@/lib/crm/operation-analytics";
vi.mock("@/hooks/useUsers",()=>({useUsers:()=>({profiles:[{id:"ana",full_name:"Ana Maria"},{id:"bob",full_name:"Bruno"}]})}));
import { OperationAnalytics } from "../OperationAnalytics";
afterEach(()=>vi.useRealTimers());
it("filters the operational cohort by responsible, preserves unknown hours and exposes actual stage times",async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();vi.setSystemTime(new Date("2026-11-13T15:00:00Z"));
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);
 const stages:TimingStage[]=[{id:"new",pipeline_id:"p",name:"Novo lead",order_index:0,is_active:true},{id:"contact",pipeline_id:"p",name:"Primeiro contato",order_index:1,is_active:true}];
 const leads=[{id:"a",name:"Cliente aguardando",pipeline_id:"p",stage_id:"new",assigned_to:"ana",received_at:"2026-11-13T12:00:00Z",entered_at:"2026-11-13"},{id:"b",name:"Cliente atendido",pipeline_id:"p",stage_id:"contact",assigned_to:"bob",received_at:"2026-11-13T12:00:00Z",entered_at:"2026-11-13"},{id:"c",name:"Cadastro antigo",pipeline_id:"p",stage_id:"new",assigned_to:"ana",received_at:null,entered_at:"2026-11-12"}] as Lead[];
 const refresh=vi.fn();
 try {
 await act(async()=>root.render(React.createElement(OperationAnalytics,{leads,history:[{lead_id:"b",pipeline_id:"p",stage_id:"contact",from_stage_id:"new",moved_at:"2026-11-13T12:10:00Z"}],stages,pipelines:[{id:"p",name:"Ana Maria CRM"}],refresh})));
 expect(host.textContent).toContain("10 min");expect(host.textContent).toContain("1 lead(s) sem hora original");
 const stage=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('média para sair da etapa'))!;
 await act(async()=>stage.click());expect(stage.getAttribute('aria-expanded')).toBe('true');expect(host.textContent).toContain('tempo até sair');
 const details=host.querySelector<HTMLElement>('#'+stage.getAttribute('aria-controls'))!;expect(details.parentElement).toBe(stage.parentElement);expect(details.previousElementSibling).toBe(stage);expect(details.getAttribute('role')).toBe('region');
 const median=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Mediana')!;
 await act(async()=>median.click());expect(median.getAttribute('aria-pressed')).toBe('true');expect(host.textContent).toContain('mediana para sair da etapa');
 const slaSelect=host.querySelector<HTMLSelectElement>('[aria-label="Meta de primeiro atendimento"]')!;
 await act(async()=>{slaSelect.value="15";slaSelect.dispatchEvent(new Event("change",{bubbles:true}));});expect(host.textContent).toContain("Atendidos em até 15 min");
 const pending=host.querySelector('a[href="/crm?lead=a"]');expect(pending).not.toBeNull();
 const select=host.querySelectorAll("select")[0];await act(async()=>{select.value="bob";select.dispatchEvent(new Event("change",{bubbles:true}));});
 expect(host.querySelector('a[href="/crm?lead=a"]')).toBeNull();expect(host.textContent).toContain("Nenhum lead aguardando");expect(host.textContent).toContain("10 min");expect(host.textContent).not.toContain("1 lead(s) sem hora original");
 const button=Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="Atualizar análise")!;await act(async()=>button.click());expect(refresh).toHaveBeenCalledTimes(1);
 } finally {await act(async()=>root.unmount());host.remove();}
});
