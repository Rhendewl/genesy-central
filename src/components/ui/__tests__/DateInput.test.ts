import {act,createElement as h,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {DateInput,DateCalendar,DateRangeCalendar,DateTimeInput} from '../DateInput';
let root:Root,host:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('honors date bounds and preserves native form values without submitting on selection',async()=>{
 const change=vi.fn(),submit=vi.fn();function Form(){const [value,setValue]=useState('2026-11-04');return h('form',{onSubmit:(e:any)=>{e.preventDefault();submit();}},h(DateInput,{name:'starts_at',id:'starts',value,min:'2026-11-03',max:'2026-11-10',required:true,onChange:event=>{change(event.target.value);setValue(event.target.value);}}));}await act(async()=>root.render(h(Form)));
 await act(async()=>document.querySelector<HTMLButtonElement>('#starts')!.click());
 expect(document.querySelector<HTMLButtonElement>('[aria-label="2 de novembro de 2026"]')!.disabled).toBe(true);
 await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="10 de novembro de 2026"]')!.click());
 expect(change).toHaveBeenCalledWith('2026-11-10');expect(new FormData(host.querySelector('form')!).get('starts_at')).toBe('2026-11-10');expect(submit).not.toHaveBeenCalled();
});
it('normalizes a reverse range and applies only after the second selection',async()=>{
 const apply=vi.fn();await act(async()=>root.render(h(DateRangeCalendar,{from:new Date(2026,10,4),to:new Date(2026,10,10),immediate:true,onApply:apply})));
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="15 de novembro de 2026"]')!.click());expect(apply).not.toHaveBeenCalled();
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="5 de novembro de 2026"]')!.click());expect(apply.mock.calls[0].map((x:Date)=>x.getDate())).toEqual([5,15]);
});
it('keeps booking availability restrictions in the shared calendar',async()=>{
 await act(async()=>root.render(h(DateCalendar,{value:'2026-11-04',allowedDates:['2026-11-04','2026-11-06'],onChange:vi.fn()})));
 expect(host.querySelector<HTMLButtonElement>('[aria-label="5 de novembro de 2026"]')!.disabled).toBe(true);expect(host.querySelector<HTMLButtonElement>('[aria-label="6 de novembro de 2026"]')!.disabled).toBe(false);
});
it('keeps a single datetime form value and separate date and time controls',async()=>{
 await act(async()=>root.render(h('form',{},h(DateTimeInput,{name:'starts_at',value:'2026-11-04T17:30',onChange:vi.fn()}))));expect(new FormData(host.querySelector('form')!).getAll('starts_at')).toEqual(['2026-11-04T17:30']);
});

it('uses the same calendar surface for month selection while preserving the month value',async()=>{
 const change=vi.fn();await act(async()=>root.render(h(DateCalendar,{value:'2026-11',monthOnly:true,onChange:change})));
 await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="dezembro de 2026"]')!.click());expect(change).toHaveBeenCalledWith('2026-12');
});
