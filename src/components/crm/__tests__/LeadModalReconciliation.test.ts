import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import type {Lead} from '@/types';
vi.mock('@/hooks/useUsers',()=>({useUsers:()=>({profiles:[]})}));
vi.mock('@/hooks/useLeadOrigins',()=>({useLeadOrigins:()=>({origins:[]})}));
vi.mock('@/hooks/useModalOpen',()=>({useModalOpen:()=>{}}));
vi.mock('@/components/tags/TagSelector',()=>({TagSelector:()=>null}));
vi.mock('@/components/crm/LeadOriginSelector',()=>({LeadOriginSelector:()=>null}));
import {LeadModal} from '../LeadModal';
it('keeps exactly one stage mover and reminder panel across edits and autosave rerenders',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn(async(url)=>Response.json(String(url).endsWith('/notes')?{notes:[],viewerId:'u',next:null}:{reminders:[]})));const warnings=vi.spyOn(console,'error').mockImplementation(()=>{});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);const lead={id:'lead-1',name:'Lead de teste',contact:'contato@example.test',notes:'',tags:[],deal_value:0,entered_at:'2026-11-04',source:'manual',pipeline_id:null,stage_id:null,iq_score:null,ie_score:null} as unknown as Lead;
 try{await act(async()=>root.render(createElement(LeadModal,{isOpen:true,lead,stages:[],pipelines:[],onClose:vi.fn(),onCreate:vi.fn(),onUpdate:vi.fn().mockResolvedValue({error:null}),onDelete:vi.fn(),onMove:vi.fn(),onTransfer:vi.fn()})));
 for(let i=0;i<6;i++){const input=document.querySelector<HTMLInputElement>('#lead-name')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,`Lead de teste ${i}`);input.dispatchEvent(new Event('input',{bubbles:true}));});await act(async()=>vi.advanceTimersByTimeAsync(900));}
 expect(document.querySelectorAll('[aria-controls="lead-stage-options"]')).toHaveLength(1);expect(document.querySelectorAll('.lead-reminders-panel')).toHaveLength(1);expect(warnings.mock.calls.filter(c=>String(c[0]).includes('same key'))).toHaveLength(0);
 }finally{await act(async()=>root.unmount());host.remove();warnings.mockRestore();vi.useRealTimers();vi.unstubAllGlobals();}
});
