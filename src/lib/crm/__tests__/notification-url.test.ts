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
