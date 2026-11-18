import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const mocks=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn(),adminFrom:vi.fn(),auth:{getUser:vi.fn()}}));
vi.mock('@/lib/supabase-server',()=>({createServerSupabaseClient:async()=>mocks}));
vi.mock('@/lib/supabase-admin',()=>({createAdminSupabaseClient:()=>({rpc:mocks.rpc,from:mocks.adminFrom})}));
import {POST} from '@/app/api/clientes/contratos/route';
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test-only');
 mocks.auth.getUser.mockResolvedValue({data:{user:{id:'owner',email:'owner@example.com'}}});
 mocks.from.mockImplementation((table:string)=>{ const q={select:vi.fn(),eq:vi.fn(),single:vi.fn().mockResolvedValue({data:table==='contract_templates'?{body:'{{cliente_nome}} {{cliente_email}} {{comissao_percentual}} {{comissao_por_extenso}} {{vigencia_meses}} {{vigencia_por_extenso}} {{vigencia_meses}} {{testemunha_1_nome}} {{testemunha_2_nome}} {{data_assinatura_por_extenso}}'}:{name:'Genesy',document:'12345678000199',address:''}})};q.select.mockReturnValue(q);q.eq.mockReturnValue(q);return q; });
 mocks.rpc.mockResolvedValue({data:'doc',error:null});
});
const body=()=>({action:'issue',template_id:'template',title:'Contrato',client:{name:'Cliente',document:'98765432000199'},values:{comissao_percentual:'5',vigencia_meses:'3'},signers:[{name:'Genesy',role:'contratada'},{name:'Cliente',role:'cliente'},{name:'Maria',role:'testemunha'},{name:'José',role:'testemunha'}]});
const send=(data:unknown)=>POST(new NextRequest('https://example.com/api/clientes/contratos',{method:'POST',body:JSON.stringify(data)}));
describe('contract issuance',()=>{
 it('issues with four signers without email and derives the actual template fields on the server',async()=>{
  const r=await send(body());expect(r.status).toBe(200);
  const args=mocks.rpc.mock.calls[0][1];expect(args.p_signers).toHaveLength(4);
  expect(args.p_signers.every((s:{email:string})=>s.email==='')).toBe(true);
  expect(args.p_doc.body).toContain('5 cinco 3 três 3 Maria José');expect(args.p_doc.body).toContain(' de ');
  expect(args.p_doc.client_data.signer_documents[args.p_signers[1].id]).toBe('98765432000199');
  expect(args.p_doc.client_data.signer_documents[args.p_signers[0].id]).toBe('12345678000199');
 });
 it('updates only the requested template owned by the authenticated user',async()=>{
  const q={update:vi.fn(),eq:vi.fn(),select:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:{id:'template-1'},error:null})};q.update.mockReturnValue(q);q.eq.mockReturnValue(q);q.select.mockReturnValue(q);mocks.from.mockReturnValue(q);
  expect((await send({action:'template',id:'template-1',name:'Editado',body:'Novo conteúdo'})).status).toBe(200);
  expect(q.eq).toHaveBeenCalledWith('id','template-1');expect(q.eq).toHaveBeenCalledWith('user_id','owner');
  expect(q.update).toHaveBeenCalledWith({name:'Editado',body:'Novo conteúdo'});expect(mocks.rpc).not.toHaveBeenCalled();
  q.maybeSingle.mockResolvedValue({data:null,error:null} as never);
  expect((await send({action:'template',id:'other-owner',name:'Editado',body:'Texto'})).status).toBe(400);
 });
 it('allows unnamed witnesses, including whitespace-only names',async()=>{
  const b=body();b.signers[2].name='';b.signers[3].name='  ';
  expect((await send(b)).status).toBe(200);
  expect(mocks.rpc.mock.calls[0][1].p_signers.slice(2).map((s:{name:string})=>s.name)).toEqual(['Testemunha','Testemunha']);
 });
 it('stores the chosen client type and rejects unsupported types',async()=>{
  const b={...body(),client:{...body().client,company_type:'corretor'}};
  expect((await send(b)).status).toBe(200);expect(mocks.rpc.mock.calls[0][1].p_doc.client_data.company_type).toBe('corretor');
  expect((await send({...b,client:{...b.client,company_type:'invalid'}})).status).toBe(400);
 });
 it('deletes only an owned contract and never directly deletes its client',async()=>{
  const owner={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:{id:'doc'},error:null})};owner.select.mockReturnValue(owner);owner.eq.mockReturnValue(owner);mocks.from.mockReturnValue(owner);
  const remove={delete:vi.fn(),eq:vi.fn(),select:vi.fn().mockResolvedValue({data:[{id:'doc'}],error:null})};remove.delete.mockReturnValue(remove);remove.eq.mockReturnValue(remove);mocks.adminFrom.mockReturnValue(remove);
  expect((await send({action:'delete',id:'doc'})).status).toBe(200);
  expect(owner.eq).toHaveBeenCalledWith('user_id','owner');expect(remove.eq).toHaveBeenCalledWith('user_id','owner');expect(mocks.adminFrom).toHaveBeenCalledWith('client_contract_documents');expect(mocks.adminFrom).not.toHaveBeenCalledWith('agency_clients');
  mocks.adminFrom.mockClear();owner.maybeSingle.mockResolvedValue({data:null,error:null} as never);
  expect((await send({action:'delete',id:'other-owner'})).status).toBe(400);expect(mocks.adminFrom).not.toHaveBeenCalled();
 });
 it('keeps each contracting signer identity separate and requires additional documents',async()=>{
  const b=body();b.signers.push(Object.assign({name:'Segundo contratante',role:'cliente'},{document:'12345678901'}));
  expect((await send(b)).status).toBe(200);
  const args=mocks.rpc.mock.calls[0][1];
  expect(args.p_doc.client_data.signer_documents[args.p_signers[1].id]).toBe('98765432000199');
  expect(args.p_doc.client_data.signer_documents[args.p_signers[4].id]).toBe('12345678901');
  const invalid=body();invalid.signers.push({name:'Sem documento',role:'cliente'});
  expect((await send(invalid)).status).toBe(400);
 });
 it('still rejects malformed supplied email',async()=>{
  const b=body();Object.assign(b.signers[2],{email:'invalido'});
  expect((await send(b)).status).toBe(400);expect(mocks.rpc).not.toHaveBeenCalled();
 });
});
