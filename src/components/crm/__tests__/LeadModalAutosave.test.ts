import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Lead } from "@/types";
vi.mock("@/hooks/useUsers",()=>({useUsers:()=>({profiles:[]})}));
vi.mock("@/hooks/useLeadOrigins",()=>({useLeadOrigins:()=>({origins:[]})}));
vi.mock("@/hooks/useModalOpen",()=>({useModalOpen:()=>{}}));
vi.mock("@/components/tags/TagSelector",()=>({TagSelector:()=>null}));
vi.mock("@/components/crm/LeadOriginSelector",()=>({LeadOriginSelector:()=>null}));
vi.mock("@/components/crm/LeadStageMover",()=>({LeadStageMover:()=>null}));
vi.mock("@/components/crm/LeadStageTimeline",()=>({LeadStageTimeline:()=>null}));
import { LeadModal } from "../LeadModal";
let host:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal("fetch",vi.fn(async (url)=>new Response(JSON.stringify(String(url).endsWith("/notes")?{notes:[],viewerId:"owner",next:null}:{reminders:[]}))));Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals();});
const lead={id:"a",name:"Ana",contact:"ana@example.com",notes:"Original",tags:[],deal_value:0,entered_at:"2026-11-04",source:"manual",origin_id:null,assigned_to:null,iq_score:null,ie_score:null} as unknown as Lead;
async function input(selector:string,value:string){const el=document.querySelector(selector)! as HTMLInputElement;await act(async()=>{Object.getOwnPropertyDescriptor(el.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value")!.set!.call(el,value);el.dispatchEvent(new Event("input",{bubbles:true}));});}
function props(){return {isOpen:true,lead,stages:[],pipelines:[],onClose:vi.fn(),onUpdate:vi.fn().mockResolvedValue({error:null}),onCreate:vi.fn(),onDelete:vi.fn(),onMove:vi.fn(),onTransfer:vi.fn()};}
it("saves edited notes automatically without closing or writing untouched fields",async()=>{
 const p=props();await act(async()=>root.render(createElement(LeadModal,p)));await act(async()=>vi.advanceTimersByTimeAsync(1000));expect(p.onUpdate).not.toHaveBeenCalled();
 await input("#lead-notes","Nova nota");expect(document.body.textContent).toContain("Aguardando salvamento");
 await act(async()=>vi.advanceTimersByTimeAsync(800));expect(p.onUpdate).toHaveBeenCalledExactlyOnceWith("a",{notes:"Nova nota"});expect(p.onClose).not.toHaveBeenCalled();expect(document.body.textContent).toContain("Todas as alterações salvas");
});
it("flushes a pending edit when the top close button is used",async()=>{
 const p=props();await act(async()=>root.render(createElement(LeadModal,p)));await input("#lead-notes","Antes de fechar");await act(async()=>(document.querySelector('[aria-label="Fechar"]') as HTMLButtonElement).click());
 expect(p.onUpdate).toHaveBeenCalledWith("a",{notes:"Antes de fechar"});expect(p.onClose).toHaveBeenCalledOnce();
});
it("keeps the modal and draft on screen if saving fails and retries explicitly",async()=>{
 const p=props();p.onUpdate.mockResolvedValueOnce({error:"network"});await act(async()=>root.render(createElement(LeadModal,p)));await input("#lead-notes","Não perder");await act(async()=>(document.querySelector('[aria-label="Fechar"]') as HTMLButtonElement).click());
 expect(p.onClose).not.toHaveBeenCalled();expect((document.querySelector("#lead-notes") as HTMLTextAreaElement).value).toBe("Não perder");
 const retry=Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Tentar novamente")!;await act(async()=>retry.click());expect(document.body.textContent).toContain("Todas as alterações salvas");
});
it("does not autosave a new lead",async()=>{
 const p={...props(),lead:null};await act(async()=>root.render(createElement(LeadModal,p)));await input("#lead-name","Novo lead");await input("#lead-contact","novo@example.com");await act(async()=>vi.advanceTimersByTimeAsync(2000));expect(p.onUpdate).not.toHaveBeenCalled();expect(p.onCreate).not.toHaveBeenCalled();
});
