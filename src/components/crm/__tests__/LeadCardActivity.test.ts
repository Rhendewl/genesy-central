import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import type {Lead} from '@/types';
vi.mock('@dnd-kit/core',()=>({useDraggable:()=>({attributes:{},listeners:{},setNodeRef:vi.fn(),isDragging:false})}));
vi.mock('@/hooks/useTags',()=>({useTags:()=>({tags:[]})}));
vi.mock('@/hooks/useLeadOrigins',()=>({useLeadOrigins:()=>({origins:[]})}));
import {LeadCard} from '../LeadCard';
it('shows distinctly labelled note and reminder indicators even without an IG score',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const lead={id:'lead',name:'Lead teste',tags:[],notes:null,source:'manual',entered_at:'2026-11-04',iq_score:null,ie_score:null} as unknown as Lead;
 try{await act(async()=>root.render(createElement(LeadCard,{lead,activity:{hasNotes:true,hasReminder:true},onEdit:vi.fn()})));expect(host.querySelector('[aria-label="Lembrete programado"]')).not.toBeNull();expect(host.querySelector('[aria-label="Possui notas"]')).not.toBeNull();expect(host.querySelector('.lead-card-notes')?.className).not.toContain('reminder');await act(async()=>root.render(createElement(LeadCard,{lead:{...lead,notes:'Registro anterior'},activity:{hasNotes:false,hasReminder:false},onEdit:vi.fn()})));expect(host.querySelector('[aria-label="Possui notas"]')).not.toBeNull();expect(host.querySelector('[aria-label="Lembrete programado"]')).toBeNull();}finally{await act(async()=>root.unmount());host.remove();}
});
