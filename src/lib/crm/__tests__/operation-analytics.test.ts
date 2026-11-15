import { describe, expect, it } from "vitest";
import type { Lead } from "@/types";
import { analyzeOperation, crmDate, formatArrival, summarizeDurations, type TimingStage, type TimingEvent } from "../operation-analytics";
const at = (minutes:number) => new Date(Date.UTC(2026,10,13,12,minutes)).toISOString();
const stages:TimingStage[]=[
  {id:"new",pipeline_id:"p",name:"Novo lead",order_index:0,is_active:true,legacy_column:"novo_lead"},
  {id:"contact",pipeline_id:"p",name:"Primeiro contato",order_index:1,is_active:true},
  {id:"visit",pipeline_id:"p",name:"Visita",order_index:2,is_active:true},
  {id:"lost",pipeline_id:"p",name:"Perdido",order_index:3,is_active:true,is_lost:true},
  {id:"sale",pipeline_id:"p",name:"Vendido",order_index:4,is_active:true,is_won:true},
];
const lead=(patch:Partial<Lead>={}):Lead=>({id:"l",pipeline_id:"p",stage_id:"new",received_at:at(0),entered_at:"2026-11-13",created_at:at(0),name:"Ana",...patch} as Lead);
const event=(stage_id:string,minutes:number,from_stage_id?:string):TimingEvent=>({id:String(minutes),lead_id:"l",pipeline_id:"p",stage_id,moved_at:at(minutes),from_stage_id});
describe("operational CRM times",()=>{
 it("measures original arrival through a delayed capture and all subsequent stages",()=>{
  const result=analyzeOperation([lead({stage_id:"visit"})],[event("new",10),event("contact",20,"new"),event("visit",50,"contact")],stages,Date.parse(at(80)));
  expect(result.firstContact.median).toBe(20*60000);
  expect(result.stages.find(s=>s.stage.id==="new")?.completed.average).toBe(20*60000);
  expect(result.stages.find(s=>s.stage.id==="contact")?.completed.average).toBe(30*60000);
  expect(result.stages.find(s=>s.stage.id==="visit")?.open.median).toBe(30*60000);
 });
 it("keeps incomplete historical times unknown and counts the waiting volume",()=>{
  const result=analyzeOperation([lead({received_at:null})],[],stages,Date.parse(at(80)));
  expect(result.waiting).toBe(1);expect(result.missingArrival).toBe(1);expect(result.overdue).toBe(0);
  expect(result.firstContact.count).toBe(0);expect(result.stages[0].open.count).toBe(0);
 });
 it("uses an explicit source stage when the initial entry event is missing",()=>{
  const result=analyzeOperation([lead({stage_id:"contact"})],[event("contact",15,"new")],stages,Date.parse(at(60)),15);
  expect(result.firstContact.median).toBe(15*60000);expect(result.withinSla).toBe(100);
 });
 it("does not count discards, same-stage deliveries, foreign events or future events as first contact",()=>{
  const foreign={...event("contact",5,"new"),pipeline_id:"other"};
  const result=analyzeOperation([lead({stage_id:"lost"})],[event("new",0),event("new",1),foreign,event("lost",10,"new"),event("contact",90,"new")],stages,Date.parse(at(60)));
  expect(result.firstContact.count).toBe(0);expect(result.waiting).toBe(0);expect(result.transitions).toHaveLength(1);
 });
 it("counts returns as separate visits without replacing the original first response",()=>{
  const result=analyzeOperation([lead({stage_id:"contact"})],[event("new",0),event("contact",5,"new"),event("new",20,"contact"),event("contact",30,"new")],stages,Date.parse(at(60)));
  expect(result.firstContact.average).toBe(5*60000);expect(result.stages[0].completed.count).toBe(1);expect(result.stages[0].allCompleted.count).toBe(2);
  expect(result.stages[0].completed.average).toBe(5*60000);expect(result.stages[0].allCompleted.average).toBe(7.5*60000);expect(result.waiting).toBe(0);
 });
 it("does not infer source-stage durations for a lead missing its original history",()=>{
  const result=analyzeOperation([lead({stage_id:"visit"})],[event("contact",15),event("visit",35)],stages,Date.parse(at(60)));
  expect(result.firstContact.count).toBe(0);expect(result.stages.find(s=>s.stage.id==="contact")?.completed.median).toBe(20*60000);
  expect(analyzeOperation([lead()],[],[],Date.parse(at(60))).waiting).toBe(0);
 });
 it("does not accumulate open time after a sale",()=>{
  const result=analyzeOperation([lead({stage_id:"sale"})],[event("new",0),event("sale",25,"new")],stages,Date.parse(at(60)));
  expect(result.stages.find(s=>s.stage.id==="sale")?.open.count).toBe(0);
 });
 it("computes percentiles without rounding away short waits and displays Brazil timezone",()=>{
  expect(summarizeDurations([1,2,3,100])).toEqual({count:4,average:26.5,median:2.5,p90:100});
  expect(crmDate("2026-11-14T01:30:00Z")).toBe("2026-11-13");
  expect(formatArrival(lead({received_at:"2026-11-13T12:25:00Z"}))).toContain("09:25");
  expect(formatArrival(lead({received_at:null}))).toContain("hora não registrada");
 });
});

describe("consistent first-attendance samples",()=>{
 it("uses exactly the same samples for the initial stage and the headline despite discards and reentries",()=>{
  const leads=[lead({id:"a",stage_id:"contact"}),lead({id:"b",stage_id:"contact"}),lead({id:"c",stage_id:"lost"}),lead({id:"d",stage_id:"visit"})];
  const forLead=(id:string,rows:TimingEvent[])=>rows.map(row=>({...row,lead_id:id}));
  const history=[...forLead("a",[event("new",0),event("contact",20,"new"),event("new",200,"contact"),event("contact",600,"new")]),...forLead("b",[event("new",0),event("contact",52,"new")]),...forLead("c",[event("new",0),event("lost",900,"new")]),...forLead("d",[event("new",0),event("visit",800,"new")])];
  const result=analyzeOperation(leads,history,stages,Date.parse(at(1000)),30);
  expect(result.firstContact.average).toBe(36*60000);
  expect(result.stages.find(s=>s.stage.id==="new")?.completed).toEqual(result.firstContact);
  expect(result.firstContact.count).toBe(2);expect(result.withinSla).toBe(50);
  expect(result.stages[0].allCompleted.count).toBe(5);
 });
 it("counts every current initial-stage lead, including a returned lead, and measures its current wait",()=>{
  const result=analyzeOperation([lead({stage_id:"new"})],[event("new",0),event("contact",5,"new"),event("new",20,"contact")],stages,Date.parse(at(60)),45);
  expect(result.waiting).toBe(1);expect(result.timings[0].waitingSince).toBe(at(20));expect(result.overdue).toBe(0);
  expect(result.firstContact.average).toBe(5*60000);
 });
 it("does not treat a reopened discard or skipped contact stage as an original first attendance",()=>{
  const result=analyzeOperation([lead({stage_id:"contact"})],[event("new",0),event("lost",10,"new"),event("new",20,"lost"),event("contact",30,"new")],stages,Date.parse(at(60)));
  expect(result.firstContact.count).toBe(0);expect(result.stages[0].completed.count).toBe(0);
 });
});
