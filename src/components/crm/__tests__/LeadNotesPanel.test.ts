import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {LeadNotesPanel} from '../LeadNotesPanel';
let host:HTMLDivElement,root:Root;
const note={id:'n1',body:'Retomar proposta amanhã',author_auth_id:'u1',author_name:'Lancaster',author_avatar:null,created_at:'2026-11-04T15:30:00Z'};
const input=async(value:string)=>act(async()=>{const el=host.querySelector('textarea')!;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const props=()=>({leadId:'lead',legacyNotes:'Registro antigo',onLegacyChange:vi.fn(),onDraftChange:vi.fn(),onSendingChange:vi.fn()});
it('shows author, avatar fallback and server timestamp without inventing legacy metadata',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({notes:[note],viewerId:'u1',next:null})));
 await act(async()=>root.render(createElement(LeadNotesPanel,props())));
 expect(host.textContent).toContain('Lancaster · você');expect(host.querySelector('time')?.dateTime).toBe(note.created_at);
 expect(host.querySelector('.lead-note-avatar')?.textContent).toBe('L');expect(host.textContent).toContain('Este registro não possui autoria ou data disponíveis.');
});
it('keeps the draft and same attempt after a lost response, then sends one message',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({notes:[],viewerId:'u1',next:null})).mockRejectedValueOnce(Error('Sem conexão')).mockResolvedValueOnce(Response.json({note}));vi.stubGlobal('fetch',fetcher);
 const p=props();await act(async()=>root.render(createElement(LeadNotesPanel,p)));await input('Retomar proposta amanhã');
 const send=()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes('Enviar nota'))!;
 await act(async()=>send().click());expect(host.querySelector('textarea')?.value).toBe(note.body);expect(host.textContent).toContain('Sem conexão');
 await act(async()=>send().click());expect(host.querySelector('textarea')?.value).toBe('');expect(host.querySelectorAll('.lead-note-message')).toHaveLength(1);
 const a=JSON.parse(fetcher.mock.calls[1][1].body),b=JSON.parse(fetcher.mock.calls[2][1].body);expect(a).toEqual(b);expect(a).toMatchObject({body:note.body});expect(a.author_name).toBeUndefined();expect(p.onSendingChange.mock.calls.map(x=>x[0])).toEqual([true,false,true,false]);
});
