import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import type {CrmStage} from '@/types/crm';
vi.mock('@/hooks/useModalOpen',()=>({useModalOpen:()=>{}}));
import {StageFormModal} from '../admin/StageFormModal';
it('centers outside transformed content, scrolls the form body and preserves stage settings',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');host.style.transform='translateY(10px)';document.body.append(host);const root=createRoot(host),save=vi.fn().mockResolvedValue(true),close=vi.fn();
 const stage={name:'Contato futuro',description:'Retomar contato',color:'#4a8fd4',is_active:true,require_note:true,require_attachment:false,allow_free_move:true,allow_edit:true,is_won:false,is_lost:false,metric_type:null} as CrmStage;
 try{await act(async()=>root.render(createElement(StageFormModal,{open:true,stage,onClose:close,onSave:save})));const panel=document.querySelector('[role=dialog]')!;expect(host.contains(panel)).toBe(false);expect(panel.parentElement?.parentElement).toBe(document.body);expect(panel.className).toContain('h-[650px]');expect(panel.querySelector('.overflow-y-auto')).not.toBeNull();expect(document.body.style.overflow).toBe('hidden');await act(async()=>panel.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));expect(save).toHaveBeenCalledWith(expect.objectContaining({name:stage.name,require_note:true,color:stage.color}));expect(close).toHaveBeenCalledOnce();}finally{await act(async()=>root.unmount());host.remove();}expect(document.body.style.overflow).toBe('');
});
