// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../[slug]/route';
import { signCalculatorAccess, accessCookieName } from '@/lib/calculadora/public-access';
const mocks = vi.hoisted(() => ({ from:vi.fn(),rpc:vi.fn(),publish:vi.fn(),tables:{} as Record<string,unknown>,captured:false,active:true }));
vi.mock('@/lib/supabase-admin',()=>({createAdminSupabaseClient:()=>({from:mocks.from,rpc:mocks.rpc})}));
vi.mock('@/lib/event-bus/platform',()=>({getPlatformEventBus:()=>({publish:mocks.publish})}));
const params = { params:{slug:'safe-link'} };
const req = (body: unknown) => new NextRequest('http://localhost/api/public/calculadora/safe-link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{
  vi.clearAllMocks();vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','unit-secret');mocks.captured=false;mocks.active=true;
  mocks.from.mockImplementation((table:string)=>{
    const chain:Record<string,unknown>={};
    for(const method of ['select','eq']) chain[method]=()=>chain;
    chain.maybeSingle=async()=>({data:table==='calculator_shares'?{id:'share',title:'Calculadora pública',active:mocks.active,user_id:'PRIVATE-OWNER',pipeline_id:'PRIVATE-PIPELINE',stage_id:'PRIVATE-STAGE'}:table==='calculator_captures'?(mocks.captured?{id:'PRIVATE-CAPTURE'}:null):{id:'stage'},error:null});
    return chain;
  });
  mocks.rpc.mockImplementation(async(name:string)=>({data:name==='calculator_take_attempt'?true:{created:false,lead_id:'PRIVATE-LEAD'},error:null}));
});
describe('rotas públicas isoladas',()=>{
  it('não expõe IDs do CRM ou dados de contatos, mesmo com acesso lembrado',async()=>{
    const token=signCalculatorAccess('safe-link','unit-secret');
    const response=await GET(new NextRequest('http://localhost/api/public/calculadora/safe-link',{headers:{cookie:`${accessCookieName('safe-link')}=${token}`}}),params);
    expect(await response.json()).toEqual({title:'Calculadora pública',granted:true});
  });
  it('não libera quem ainda não se cadastrou',async()=>{
    const response=await POST(req({action:'resume',phone:'85999991234'}),params);
    expect(response.status).toBe(404); expect(response.cookies.get(accessCookieName('safe-link'))).toBeUndefined();
  });
  it('retoma em outro dispositivo sem devolver dados do cadastro',async()=>{
    mocks.captured=true;
    const response=await POST(req({action:'resume',phone:'85999991234'}),params);
    expect(await response.json()).toEqual({granted:true});
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=lax');
  });
  it('registra no destino definido no servidor, ignorando IDs enviados pelo visitante',async()=>{
    const response=await POST(req({action:'register',name:'Marina',email:'marina@example.com',phone:'85999991234',profile:'corretor',user_id:'attacker',pipeline_id:'attacker'}),params);
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('calculator_register',{p_slug:'safe-link',p_name:'Marina',p_email:'marina@example.com',p_phone:'5585999991234',p_profile:'corretor',p_creci:''});
    expect(await response.json()).toEqual({granted:true});
  });
  it('respeita links pausados, limites de tentativa e falhas no banco',async()=>{
    mocks.active=false;expect((await POST(req({action:'resume',phone:'85999991234'}),params)).status).toBe(404);
    mocks.active=true;mocks.rpc.mockResolvedValueOnce({data:false,error:null});expect((await POST(req({action:'resume',phone:'85999991234'}),params)).status).toBe(429);
    mocks.rpc.mockResolvedValueOnce({data:null,error:new Error('db')});expect((await POST(req({action:'resume',phone:'85999991234'}),params)).status).toBe(503);
  });
});
