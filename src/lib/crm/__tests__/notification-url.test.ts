import {describe,it,expect,vi} from 'vitest';
import {crmNotificationUrl,crmNotificationAfterLogin} from '../notification-url';
import {createCrmStageNotificationConsumer} from '@/lib/event-bus/crm/consumers/stage-notification';
import {dispatchPushToUser} from '@/lib/notifications/push-dispatcher';
vi.mock('@/lib/notifications/push-dispatcher',()=>({dispatchPushToUser:vi.fn(),renderTemplate:(text:string)=>text}));
describe('CRM notification destination',()=>{
 it('preserves the pipeline and lead through the login screen',()=>{
  const target=crmNotificationUrl('pipeline-2','lead-1');
  expect(target).toBe('/crm?pipeline=pipeline-2&lead=lead-1');
  expect(crmNotificationAfterLogin('?'+target.split('?')[1])).toBe(target);
  expect(crmNotificationAfterLogin('?next=https://external.example')).toBe('/');
  expect(crmNotificationUrl(null,'lead-1')).toBe('/crm?lead=lead-1');
 });
 it('builds local encoded URLs for parameter values',()=>{
  expect(crmNotificationAfterLogin('?pipeline=https://example.com&lead=a%26x%3Dy')).toBe('/crm?pipeline=https%3A%2F%2Fexample.com&lead=a%26x%3Dy');
 });
 it('dispatches a lead arrival notification directly to its pipeline',async()=>{
  const db={from:(table:string)=>{const data=table==='leads'?{user_id:'owner',name:'Ana'}:table==='crm_notification_rules'?{channels:['pwa'],title:'Lead novo',body:'Entrou um lead'}:{name:'Entrada',crm_pipelines:{name:'Pipeline B'}};const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data})};return q;}};
  await createCrmStageNotificationConsumer(db as never).handle({id:'event',type:'lead.stage.entered',payload:{pipelineId:'pipeline-B',stageId:'stage-B',leadId:'lead-B'}} as never);
  expect(dispatchPushToUser).toHaveBeenCalledWith(db,'owner','Lead novo','Entrou um lead',expect.objectContaining({url:'/crm?pipeline=pipeline-B&lead=lead-B'}));
 });
});

describe('aviso de chegada de lead sem regra configurada',()=>{
 const makeDb=(lead:Record<string,unknown>,assignee:Record<string,unknown>|null)=>({from:(table:string)=>{
  const data=table==='leads'?lead:table==='crm_notification_rules'?null:table==='user_profiles'?assignee:{name:'Novo lead | Social Selling',crm_pipelines:{name:'GENESY CRM',default_assignee_id:'perfil-dono'}};
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data})};return q;}});
 it('avisa o dono quando o lead vem de formulário ou site, mesmo sendo ele o responsável',async()=>{
  vi.mocked(dispatchPushToUser).mockClear();
  const db=makeDb({user_id:'owner',name:'Ana',source:'site_guia-impulsionar',assigned_to:null},{auth_user_id:'owner',is_active:true,full_name:'Dono'});
  await createCrmStageNotificationConsumer(db as never).handle({id:'e1',type:'lead.stage.entered',payload:{pipelineId:'p',stageId:'s',leadId:'l',fromStageId:null,userId:'owner'}} as never);
  expect(dispatchPushToUser).toHaveBeenCalledTimes(1);
  expect(dispatchPushToUser).toHaveBeenCalledWith(db,'owner',expect.any(String),expect.any(String),expect.anything());
 });
 it('avisa dono e responsável quando são pessoas diferentes',async()=>{
  vi.mocked(dispatchPushToUser).mockClear();
  const db=makeDb({user_id:'owner',name:'Ana',source:'formulario_genesy',assigned_to:'perfil-sdr'},{auth_user_id:'sdr',is_active:true,full_name:'SDR'});
  await createCrmStageNotificationConsumer(db as never).handle({id:'e2',type:'lead.stage.entered',payload:{pipelineId:'p',stageId:'s',leadId:'l',fromStageId:null,userId:'owner'}} as never);
  expect(vi.mocked(dispatchPushToUser).mock.calls.map(c=>c[1]).sort()).toEqual(['owner','sdr']);
 });
 it('não avisa quem digitou o lead à mão no CRM',async()=>{
  vi.mocked(dispatchPushToUser).mockClear();
  const db=makeDb({user_id:'owner',name:'Ana',source:'manual',assigned_to:null},{auth_user_id:'owner',is_active:true,full_name:'Dono'});
  await createCrmStageNotificationConsumer(db as never).handle({id:'e3',type:'lead.stage.entered',payload:{pipelineId:'p',stageId:'s',leadId:'l',fromStageId:null,userId:'owner'}} as never);
  expect(dispatchPushToUser).not.toHaveBeenCalled();
 });
});
