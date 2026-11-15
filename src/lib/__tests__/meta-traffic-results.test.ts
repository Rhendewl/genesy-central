import {describe,expect,it} from 'vitest';
import {extractLeads,getActionCount,type MetaInsightAction} from '../meta-api';
import {aggregateTrafficReport,buildTrafficReportCampaignOptions,defaultTrafficReportCampaignIds} from '../traffic-report';
const actions=(values:Record<string,number|string>):MetaInsightAction[]=>Object.entries(values).map(([action_type,value])=>({action_type,value:String(value)}));
describe('paid traffic lead results',()=>{
 it('includes WhatsApp/Direct conversation starts without counting contacts, replies or message depth again',()=>{
  expect(extractLeads(actions({'onsite_conversion.messaging_conversation_started_7d':2,'onsite_conversion.total_messaging_connection':4,'onsite_conversion.messaging_first_reply':1,'onsite_conversion.messaging_conversation_replied_7d':2,'onsite_conversion.messaging_user_depth_2_message_send':1}))).toBe(2);
 });
 it('combines website leads and conversations while ignoring their aggregate aliases',()=>{
  expect(extractLeads(actions({'lead':2,'offsite_conversion.fb_pixel_lead':2,'onsite_web_lead':2,'offsite_lead_add_20_s_calls':2,'onsite_conversion.messaging_conversation_started_7d':4,'onsite_conversion.total_messaging_connection':5,'onsite_conversion.messaging_first_reply':1}))).toBe(6);
 });
 it('retains form lead totals and adds conversation starts',()=>{
  expect(extractLeads(actions({'lead':18,'onsite_conversion.lead_grouped':18}))).toBe(18);
  expect(extractLeads(actions({'lead':2,'onsite_conversion.lead_grouped':2,'onsite_conversion.messaging_conversation_started_7d':1}))).toBe(3);
 });
 it('counts disjoint form/pixel components once even when the total lead alias is also supplied',()=>{
  expect(extractLeads(actions({'lead':9,'leadgen.other':5,'onsite_conversion.lead_grouped':5,'offsite_conversion.fb_pixel_lead':4,'onsite_conversion.messaging_conversation_started_7d':3}))).toBe(12);
  expect(extractLeads(actions({'leadgen.other':5,'offsite_conversion.fb_pixel_lead':4}))).toBe(9);
  expect(extractLeads(actions({'lead':5,'leadgen.other':5}))).toBe(5);
 });
 it('never turns link clicks or message replies into conversation starts',()=>{
  expect(extractLeads(actions({'link_click':200,'onsite_conversion.total_messaging_connection':10,'onsite_conversion.messaging_first_reply':5,'onsite_conversion.messaging_conversation_replied_7d':15}))).toBe(0);expect(extractLeads(undefined)).toBe(0);
 });
 it('uses the canonical conversation count including an explicit zero before a legacy alias',()=>{
  expect(extractLeads(actions({'onsite_conversion.messaging_conversation_started_7d':3,'messaging_conversation_started_7d':3}))).toBe(3);
  expect(extractLeads(actions({'onsite_conversion.messaging_conversation_started_7d':0,'messaging_conversation_started_7d':3}))).toBe(0);
  expect(extractLeads(actions({'messaging_conversation_started_7d':3}))).toBe(3);
 });
 it('ignores invalid counters without poisoning valid data',()=>{
  expect(getActionCount([{action_type:'lead',value:'NaN'},{action_type:'lead',value:'-3'},{action_type:'lead',value:'2'},{action_type:'lead',value:'Infinity'}],'lead')).toBe(2);
 });
 it('includes messaging campaigns in report selection, totals, ranking and CPL through the stored lead metric',()=>{
  const campaigns=[{id:'wa',name:'Conversas WhatsApp',status:'ativa'},{id:'ig',name:'Mensagens Direct',status:'ativa'},{id:'form',name:'Formulário',status:'ativa'}];
  const metrics=[{campaign_id:'wa',spend:200,leads:extractLeads(actions({'onsite_conversion.messaging_conversation_started_7d':10})),impressions:1000,reach:800,clicks:100,conversions:10},{campaign_id:'ig',spend:100,leads:extractLeads(actions({'onsite_conversion.messaging_conversation_started_7d':5})),impressions:1000,reach:800,clicks:100,conversions:5},{campaign_id:'form',spend:100,leads:extractLeads(actions({'lead':5,'onsite_conversion.lead_grouped':5})),impressions:1000,reach:800,clicks:100,conversions:5}];
  expect(defaultTrafficReportCampaignIds(buildTrafficReportCampaignOptions(campaigns,metrics))).toEqual(['wa','form','ig']);
  const report=aggregateTrafficReport({clientName:'Teste',since:'2026-11-01',until:'2026-11-04',campaigns,metrics});expect(report.metrics.leads).toBe(20);expect(report.metrics.cpl).toBe(20);expect(report.campaigns.find(c=>c.id==='wa')?.cpl).toBe(20);
 });
});
