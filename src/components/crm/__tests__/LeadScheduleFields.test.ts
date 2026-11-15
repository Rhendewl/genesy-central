import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {LeadScheduleFields} from '../LeadScheduleFields';
let host:HTMLDivElement,root:Root;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('opens a themed calendar and selects the date without submitting its surrounding form',async()=>{
 const change=vi.fn(),submit=vi.fn();await act(async()=>root.render(createElement('form',{onSubmit:(e:any)=>{e.preventDefault();submit();}},createElement(LeadScheduleFields,{value:'2026-11-04T17:30',onChange:change,disabled:false}))));
 await act(async()=>(document.querySelector('.lead-schedule-trigger') as HTMLButtonElement).click());
 const next=document.querySelector<HTMLButtonElement>('[aria-label="Próximo mês"]')!;await act(async()=>next.click());const day=document.querySelector<HTMLButtonElement>('[aria-label="10 de dezembro de 2026"]')!;await act(async()=>day.click());expect(change).toHaveBeenCalledWith('2026-12-10T17:30');expect(submit).not.toHaveBeenCalled();
});
it('changes time separately and keeps the date',async()=>{
 const change=vi.fn();await act(async()=>root.render(createElement(LeadScheduleFields,{value:'2026-11-04T17:30',onChange:change,disabled:false})));
 await act(async()=>(document.querySelectorAll('.lead-schedule-trigger')[1] as HTMLButtonElement).click());await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Hora 09"]')!.click());expect(change).toHaveBeenCalledWith('2026-11-04T09:30');await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Minuto 45"]')!.click());expect(change).toHaveBeenCalledWith('2026-11-04T17:45');
});
