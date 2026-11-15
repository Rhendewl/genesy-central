import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {mkdirSync,writeFileSync} from 'node:fs';
import type {Lead} from '@/types';
vi.mock('@/hooks/useUsers',()=>({useUsers:()=>({profiles:[]})}));
vi.mock('@/hooks/useLeadOrigins',()=>({useLeadOrigins:()=>({origins:[]})}));
vi.mock('@/hooks/useModalOpen',()=>({useModalOpen:()=>{}}));
vi.mock('@/components/tags/TagSelector',()=>({TagSelector:()=>null}));
vi.mock('@/components/crm/LeadOriginSelector',()=>({LeadOriginSelector:()=>null}));
vi.mock('@/components/crm/LeadStageMover',()=>({LeadStageMover:()=>createElement("div",{"data-testid":"stage-mover"},"Mover lead")}));
import {LeadModal} from '../LeadModal';
it('keeps data left, notes right, with mobile pane switching and a reminder entry point',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const notes=[{id:'n1',body:'Gostou da proposta e pediu para retomar a conversa amanhã. Prefere contato após as 14h.',author_auth_id:'u1',author_name:'Lancaster Matos',author_avatar:null,created_at:'2026-11-04T15:30:00Z'},{id:'n2',body:'Apresentação enviada. Próximo passo: confirmar a disponibilidade para uma visita.',author_auth_id:'u2',author_name:'Ana Silva',author_avatar:null,created_at:'2026-11-04T15:40:00Z'}];
 vi.stubGlobal('fetch',vi.fn(async(url)=>Response.json(String(url).endsWith('/notes')?{notes,viewerId:'u1',next:null}:{reminders:[]})));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const lead={id:'lead',name:'Lead de demonstração',contact:'contato@example.com',notes:'Interesse em imóveis para investimento.',tags:[],deal_value:450000,entered_at:'2026-11-04',source:'manual',origin_id:null,assigned_to:null,iq_score:72,ie_score:65} as unknown as Lead;
 try{
 await act(async()=>root.render(createElement(LeadModal,{isOpen:true,lead,stages:[],pipelines:[],onClose:vi.fn(),onCreate:vi.fn(),onUpdate:vi.fn().mockResolvedValue({error:null}),onDelete:vi.fn(),onMove:vi.fn(),onTransfer:vi.fn()})));
 const cols=document.querySelector('.lead-collaboration-columns')!;expect(cols.children[0].className).toContain('data-column');expect(cols.children[1].className).toContain('notes-column');expect(document.body.textContent).toContain('Criar lembrete');const mover=document.querySelector('[data-testid="stage-mover"]')!,reminders=document.querySelector('.lead-reminders-panel')!;expect(mover.compareDocumentPosition(reminders)&4).toBe(4);
 const notesTab=Array.from(document.querySelectorAll('.lead-collab-mobile-tabs button')).find(b=>b.textContent?.includes('Notas'))! as HTMLButtonElement;await act(async()=>notesTab.click());expect(cols.getAttribute('data-mobile-pane')).toBe('notes');
 if(process.env.LEAD_UI_PREVIEW){mkdirSync('ui-preview',{recursive:true});writeFileSync('ui-preview/index.html',`<!doctype html><html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="collaboration.css"><style>body{background:#08090d}body>div{opacity:1!important} .lead-collaboration-modal{opacity:1!important;transform:none!important} .lead-collaboration-header:before{content:'PRÉVIA · DADOS SIMULADOS';font-size:9px;color:#a8a2ff}</style><body>${document.body.innerHTML}</body></html>`);}
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
