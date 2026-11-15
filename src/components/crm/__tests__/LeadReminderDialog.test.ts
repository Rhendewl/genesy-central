import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {writeFileSync} from 'node:fs';
vi.mock('@/hooks/useModalOpen',()=>({useModalOpen:()=>{}}));
vi.mock('@/hooks/useGoogleCalendarEvents',()=>({invalidateGoogleCalendarEvents:vi.fn()}));
import {LeadReminderDialog} from '../LeadReminderDialog';
let host:HTMLDivElement,root:Root;
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
const props=()=>({leadId:'lead',leadName:'Lead de demonstração',onClose:vi.fn(),onCreated:vi.fn()});
it('offers reconnect and disables creation when Google is disconnected',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>Response.json({connected:false})));await act(async()=>root.render(createElement(LeadReminderDialog,props())));expect(document.querySelector<HTMLButtonElement>('button[type=submit]')?.disabled).toBe(true);expect(document.querySelector<HTMLAnchorElement>('a.lead-google-connect')?.getAttribute('href')).toBe('/api/google-calendar/connect');});
it('shows the connected account and confirms the Google + app reminder together',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({connected:true,connection:{google_account_email:'demo@example.com'}})).mockResolvedValueOnce(Response.json({reminder:{id:'saved'}}));vi.stubGlobal('fetch',fetcher);const p=props();await act(async()=>root.render(createElement(LeadReminderDialog,p)));
 expect(document.body.textContent).toContain('demo@example.com');expect(document.body.textContent).toContain('Aviso no Google + central do Genesy');
 if(process.env.LEAD_UI_PREVIEW)writeFileSync('ui-preview/reminder.html',`<!doctype html><html class="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="collaboration.css"><style>body{background:#08090d} [data-slot=dialog-content]{opacity:1!important} body:before{content:'PRÉVIA · DADOS SIMULADOS';color:#a8a2ff;position:fixed;left:15px;top:15px;font-size:10px}</style><body>${document.body.innerHTML}</body></html>`);
 await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));expect(p.onCreated).toHaveBeenCalledOnce();expect(p.onClose).toHaveBeenCalledOnce();const body=JSON.parse(fetcher.mock.calls[1][1].body);expect(body.title).toBe('Falar com Lead de demonstração');expect(body.noticeMinutes).toBe(10);expect(Date.parse(body.end)-Date.parse(body.start)).toBe(15*60000);
});
it('retries a pending event with its original instants even on a device in another timezone',async()=>{
 const pending={id:'attempt',title:'Contato',description:'Contexto',start_at:'2026-12-01T15:30:00Z',end_at:'2026-12-01T15:45:00Z',notify_at:'2026-12-01T15:20:00Z',timezone:'Asia/Tokyo',notice_minutes:10,status:'google_error',google_event_url:null,notified_at:null};
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({connected:true})).mockResolvedValueOnce(Response.json({reminder:pending}));vi.stubGlobal('fetch',fetcher);await act(async()=>root.render(createElement(LeadReminderDialog,{...props(),pending})));
 expect(document.querySelector('#lead-reminder-date-value')?.textContent).toBe('02/12/2026');expect(document.querySelector('#lead-reminder-time-value')?.textContent).toBe('00:30');await act(async()=>document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));const body=JSON.parse(fetcher.mock.calls[1][1].body);expect(body.start).toBe('2026-12-01T15:30:00.000Z');expect(body.end).toBe('2026-12-01T15:45:00.000Z');expect(body.timezone).toBe('Asia/Tokyo');
});
