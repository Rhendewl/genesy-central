import {act,createElement as h,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {AnalyticsPeriodPicker} from '../AnalyticsPeriodPicker';
import {PipelineFilter} from '../PipelineFilter';
import type {CrmPipelineWithStages} from '@/types/crm';
let root:Root,host:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('selects an inclusive range in a single calendar and applies after two clicks, including reverse order',async()=>{
 const change=vi.fn();await act(async()=>root.render(h(AnalyticsPeriodPicker,{start:'2026-11-01',end:'2026-11-13',onChange:change})));
 expect(host.querySelectorAll('input[type=date]')).toHaveLength(0);
 await act(async()=>host.querySelector<HTMLButtonElement>('button')!.click());
 await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="15 de novembro de 2026"]')!.click());expect(change).not.toHaveBeenCalled();
 await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="5 de novembro de 2026"]')!.click());
 expect(change).toHaveBeenCalledWith('2026-11-05','2026-11-15');
});
it('selects multiple pipelines, searches without clearing selection and resets to all',async()=>{
 const pipelines=[{id:'a',name:'Ana Maria',color:'#38bdf8'},{id:'b',name:'Comercial',color:'#a78bfa'}] as CrmPipelineWithStages[];
 const change=vi.fn();function Harness(){const[value,setValue]=useState<string[]|null>(null);return h(PipelineFilter,{pipelines,value,onChange:ids=>{change(ids);setValue(ids);}});}
 await act(async()=>root.render(h(Harness)));
 await act(async()=>host.querySelector<HTMLButtonElement>('button')!.click());
 const find=(name:string)=>Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(b=>b.textContent===name)!;
 await act(async()=>find('Ana Maria').click());expect(change).toHaveBeenLastCalledWith(['a']);
 await act(async()=>find('Comercial').click());expect(change).toHaveBeenLastCalledWith(['a','b']);
 const search=document.querySelector<HTMLInputElement>('[aria-label="Buscar pipeline"]')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(search,'Ana');search.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(find('Comercial')).toBeUndefined();expect(find('Ana Maria').getAttribute('aria-pressed')).toBe('true');
 await act(async()=>find('Todas as pipelines').click());expect(change).toHaveBeenLastCalledWith(null);
});
