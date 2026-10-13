import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PublicCalculator from '../[slug]/page';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Providers } from '@/components/layout/Providers';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),path:'/simular/public-link'}));
vi.mock('next/navigation',()=>({useParams:()=>({slug:'public-link'}),usePathname:()=>mocks.path}));
vi.mock('next/dynamic',()=>({default:()=>({children,publicMode}:{children?:React.ReactNode;publicMode?:boolean})=>React.createElement('div',{'data-testid':publicMode?'public-calculator':'internal-provider'},children)}));
vi.mock('next/image',()=>({default:(props:React.ImgHTMLAttributes<HTMLImageElement>)=>React.createElement('img',props)}));
vi.mock('sonner',()=>({Toaster:()=>null}));
vi.mock('@/components/ui/button',()=>({Button:({loading:_loading,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{loading?:boolean})=>React.createElement('button',props)}));
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
let container:HTMLDivElement;let root:Root;
const response=(data:unknown,ok=true)=>({ok,json:async()=>data});
beforeEach(()=>{vi.clearAllMocks();mocks.path='/simular/public-link';vi.stubGlobal('fetch',mocks.fetch);container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function render(){await act(async()=>root.render(React.createElement(PublicCalculator)));}
describe('captura pública',()=>{
  it('remove providers e navegação interna mesmo para um navegador já logado',async()=>{
    await act(async()=>root.render(React.createElement(Providers,null,React.createElement(AuthLayout,null,React.createElement('p',null,'Público')))));
    expect(container.textContent).toBe('Público');expect(container.querySelector('[data-testid="internal-provider"]')).toBeNull();
  });
  it('um navegador lembrado recebe diretamente a calculadora',async()=>{
    mocks.fetch.mockResolvedValue(response({title:'Calculadora',granted:true}));await render();expect(container.querySelector('[data-testid="public-calculator"]')).not.toBeNull();expect(container.querySelector('form')).toBeNull();
  });
  it('mostra cadastro e permite a recuperação somente por contato',async()=>{
    mocks.fetch.mockResolvedValueOnce(response({title:'Simule aqui',granted:false}));await render();
    expect(container.querySelector('[name="creci"]')?.hasAttribute('required')).toBe(false);expect(container.querySelectorAll('[name="profile"] option')).toHaveLength(4);
    await act(async()=>Array.from(container.querySelectorAll('button')).find(b=>b.textContent==='Já me cadastrei')!.click());
    expect(container.querySelector('[name="email"]')).toBeNull();expect(container.querySelector('[name="phone"]')).not.toBeNull();
    const phone=container.querySelector<HTMLInputElement>('[name="phone"]')!;phone.value='85999991234';
    mocks.fetch.mockResolvedValueOnce(response({granted:true}));await act(async()=>Simulate.submit(container.querySelector('form')!));
    expect(JSON.parse(mocks.fetch.mock.calls[1][1].body)).toMatchObject({action:'resume',phone:'85999991234'});
    expect(container.querySelector('[data-testid="public-calculator"]')).not.toBeNull();
  });
});
