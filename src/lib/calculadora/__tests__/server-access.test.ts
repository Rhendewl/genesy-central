// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculatorContext } from '../server';
const mocks=vi.hoisted(()=>({user:{id:'member'} as {id:string}|null,profiles:[] as Record<string,unknown>[],admin:{}}));
vi.mock('@/lib/supabase-server',()=>({createServerSupabaseClient:async()=>({auth:{getUser:async()=>({data:{user:mocks.user}})},from:()=>({select:()=>({eq:async()=>({data:mocks.profiles,error:null})})})})}));
vi.mock('@/lib/supabase-admin',()=>({createAdminSupabaseClient:()=>mocks.admin}));
beforeEach(()=>{mocks.user={id:'member'};mocks.profiles=[];});
describe('gestão das capturas segue as permissões do CRM',()=>{
  it('rejeita visitantes, perfis inativos e membros sem CRM',async()=>{
    mocks.user=null;await expect(calculatorContext()).rejects.toMatchObject({status:401});mocks.user={id:'member'};
    mocks.profiles=[{owner_id:'owner',is_active:false,role:'comercial',permissions:['calculadora','crm']}];await expect(calculatorContext()).rejects.toMatchObject({status:403});
    mocks.profiles=[{owner_id:'owner',is_active:true,role:'comercial',permissions:['calculadora']}];await expect(calculatorContext()).rejects.toMatchObject({status:403});
  });
  it('limita colaboradores à pipeline atribuída e mantém o workspace do convite',async()=>{
    mocks.profiles=[{owner_id:'owner',is_active:true,role:'comercial',permissions:['calculadora','crm'],crm_pipeline_id:'allowed'}];
    expect(await calculatorContext()).toMatchObject({ownerId:'owner',restrictedPipelineId:'allowed'});
    mocks.profiles[0].crm_pipeline_id=null;await expect(calculatorContext()).rejects.toMatchObject({status:403});
  });
  it('permite ao proprietário escolher entre suas pipelines',async()=>{
    mocks.profiles=[{owner_id:'member',is_active:true,role:'admin',permissions:[]}];expect(await calculatorContext()).toMatchObject({ownerId:'member',restrictedPipelineId:null});
  });
});
