import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
vi.mock('@/hooks/useUsers',()=>({useUsers:()=>({profiles:[],isLoading:false})}));
vi.mock('@/hooks/useModalOpen',()=>({useModalOpen:()=>{}}));
import {PipelineFormModal} from '../admin/PipelineFormModal';
it('portals outside the animated page, locks page scrolling and keeps content inside a fixed-size modal',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');host.style.transform='translateY(10px)';document.body.append(host);const root=createRoot(host),close=vi.fn();try{
 await act(async()=>root.render(createElement(PipelineFormModal,{open:true,pipeline:null,onClose:close,onSave:vi.fn()})));const panel=document.querySelector('[role=dialog]')!;expect(host.contains(panel)).toBe(false);expect(panel.parentElement?.parentElement).toBe(document.body);expect(panel.className).toContain('h-[650px]');expect(panel.querySelector('form')?.className).toContain('overflow-y-auto');expect(document.body.style.overflow).toBe('hidden');await act(async()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'})));expect(close).toHaveBeenCalledOnce();
 }finally{await act(async()=>root.unmount());host.remove();}expect(document.body.style.overflow).toBe('');
});
