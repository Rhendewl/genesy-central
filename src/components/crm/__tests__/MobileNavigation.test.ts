import {act,createElement as h,useState} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('@/components/ui/FinancialPrivacyButton',()=>({FinancialPrivacyButton:()=>h('button',{'aria-label':'Ocultar valores'},'Privacidade')}));
import {CrmMobileNavigation} from '../CrmMobileNavigation';
import {MobileFilterDisclosure} from '../MobileFilterDisclosure';
let root:Root,host:HTMLDivElement;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('restores horizontal section buttons and exposes only authorized sections',async()=>{
 const change=vi.fn();await act(async()=>root.render(h(CrmMobileNavigation,{value:'kanban',tabs:[{id:'kanban',label:'Funil'},{id:'leads',label:'Análise do CRM'}],onChange:change})));
 expect(host.querySelector('select')).toBeNull();
 const tabs=Array.from(host.querySelectorAll<HTMLButtonElement>('.crm-mobile-tab'));
 expect(tabs.map(tab=>tab.textContent)).toEqual(['Funil','Análise do CRM']);
 expect(tabs[0].getAttribute('aria-current')).toBe('page');
 await act(async()=>tabs[1].click());expect(change).toHaveBeenCalledWith('leads');
 expect(host.querySelector('[aria-label="Ocultar valores"]')).not.toBeNull();
});
it('collapses the mobile filters without unmounting or resetting their values',async()=>{
 function Child(){const[value,setValue]=useState('ana');return h('select',{'aria-label':'Responsável',value,onChange:e=>setValue((e.currentTarget as HTMLSelectElement).value)},h('option',{value:'ana'},'Ana'),h('option',{value:'bruno'},'Bruno'));}
 await act(async()=>root.render(h(MobileFilterDisclosure,{summary:'Últimos 30 dias',children:h(Child)})));
 const trigger=host.querySelector('button')!,select=host.querySelector('select')!;
 await act(async()=>trigger.click());expect(trigger.getAttribute('aria-expanded')).toBe('true');
 await act(async()=>{select.value='bruno';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await act(async()=>trigger.click());expect(trigger.getAttribute('aria-expanded')).toBe('false');
 expect(host.querySelector('select')).toBe(select);expect(select.value).toBe('bruno');
});
