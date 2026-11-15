import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {it,vi,expect} from 'vitest';
import {SignaturePage} from '@/app/assinar/[token]/signature-page';
it('refreshes other signatures without erasing the name being entered',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
 let signed=false;
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({document:{id:'doc',title:'Contrato',body:'Texto original',content_hash:'hash',status:'pending',expires_at:'2099-01-01'},signer:{name:'',document:'',signed_at:null,requires_email_verification:false},signers:[{id:'witness',name:'Testemunha',role:'testemunha',signed_at:null},{id:'client',name:'Cliente',role:'cliente',signed_at:signed?'2026-11-06T12:00:00Z':null,signed_name:signed?'Cliente':null}],consent:'Confirmo a leitura'})));
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(createElement(SignaturePage,{token:'a'.repeat(64)})));
  const field=host.querySelector<HTMLInputElement>('input[autocomplete="name"]')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(field,'Nome em preenchimento');field.dispatchEvent(new Event('input',{bubbles:true}));});
  await act(async()=>{signed=true;await vi.advanceTimersByTimeAsync(4000);});
  expect(field.value).toBe('Nome em preenchimento');
  expect(host.querySelector('.contract-signing-seal')?.textContent).toContain('Código da assinatura: client');
  const details=host.querySelector<HTMLDetailsElement>('.contract-public-signers')!;
  expect(details.open).toBe(false);
  expect(host.querySelector('form')!.compareDocumentPosition(details)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(host.textContent).toContain('Natural · Escrita à mão');
  expect(host.textContent).toContain('Leve · Traço fino');
  expect(host.querySelector('.contract-public-caption')?.textContent).toBe('ASSINATURA DE CONTRATOS');
  if(process.env.CONTRACT_UI_PREVIEW){mkdirSync('/tmp/contracts-preview',{recursive:true});writeFileSync('/tmp/contracts-preview/public-options.html',`<!doctype html><meta charset="utf-8"><style>${readFileSync('src/components/clientes/contracts.css','utf8')}body{margin:0;font-family:Arial;--bg-modal:#141618;--border:#ffffff20;--text-title:#f4f4f5;--input:#1a1c1f;--muted-foreground:#9ca0a8}button,input{font:inherit;color:inherit}*{box-sizing:border-box}</style>${host.innerHTML}`);}
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();}
});
