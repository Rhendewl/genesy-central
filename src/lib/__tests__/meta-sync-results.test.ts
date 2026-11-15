import {afterEach,expect,it,vi} from 'vitest';
import type {SupabaseClient} from '@supabase/supabase-js';
const m=vi.hoisted(()=>({campaigns:vi.fn(),insights:vi.fn(),geo:vi.fn(),ads:vi.fn(),messaging:vi.fn()}));
vi.mock('@/lib/meta-api',async original=>({...await original<object>(),getMessagingBreakdown:m.messaging,getCampaigns:m.campaigns,getInsights:m.insights,getInsightsGeo:m.geo,getAdsWithCreatives:m.ads}));
import {syncMetaAccount} from '../meta-sync';
afterEach(()=>vi.restoreAllMocks());
it('persists messaging lead totals consistently in daily and geographic metrics, replacing the same keys on repeated syncs',async()=>{
 m.messaging.mockResolvedValue(new Map([['external:2026-11-01',{total:4,whatsapp:3,direct:1,messenger:0,unclassified:0}]]));
 vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'warn').mockImplementation(()=>{});
 m.campaigns.mockResolvedValue([{id:'external',name:'Campanha teste',status:'ACTIVE',objective:'OUTCOME_ENGAGEMENT',created_time:'2026-11-01T12:00:00Z'}]);
 const actions=[{action_type:'lead',value:'2'},{action_type:'offsite_conversion.fb_pixel_lead',value:'2'},{action_type:'onsite_conversion.messaging_conversation_started_7d',value:'4'},{action_type:'onsite_conversion.total_messaging_connection',value:'5'},{action_type:'onsite_conversion.messaging_first_reply',value:'1'}];
 const row={campaign_id:'external',date_start:'2026-11-01',spend:'30',impressions:'1000',reach:'900',clicks:'50',actions};m.insights.mockResolvedValue([row]);m.geo.mockResolvedValue([{...row,region:'Ceará'}]);m.ads.mockResolvedValue([]);
 const writes:{table:string;value:any;options:any}[]=[];
 const db={from:(table:string)=>{let operation='select',single=false;const q:any={};for(const method of ['select','eq','in','not','gte','lte'])q[method]=()=>q;q.insert=()=>{operation='insert';return q;};q.update=()=>{operation='update';return q;};q.delete=()=>{operation='delete';return q;};q.upsert=(value:any,options:any)=>{operation='upsert';writes.push({table,value,options});return q;};q.single=()=>{single=true;return q;};q.then=(resolve:any,reject:any)=>Promise.resolve({data:single&&table==='meta_sync_logs'?{id:'log'}:operation==='select'&&table==='campaigns'?[{id:'internal',external_id:'external'}]:[],error:null}).then(resolve,reject);return q;}};
 const params={supabase:db as unknown as SupabaseClient,userId:'user',platformAccountId:'account',adAccountId:'act_1',clientId:null,includeInExpenses:false,accessToken:'test-token',since:'2026-11-01',until:'2026-11-01'};
 await expect(syncMetaAccount(params)).resolves.toMatchObject({metricsSynced:1,warnings:[]});await syncMetaAccount(params);
 for(const table of ['campaign_metrics','campaign_geo_metrics']){const entries=writes.filter(w=>w.table===table);expect(entries).toHaveLength(2);for(const entry of entries){expect(entry.value[0]).toMatchObject({campaign_id:'internal',user_id:'user',platform_account_id:'account',date:'2026-11-01',leads:6});expect(entry.options.onConflict).toBe(table==='campaign_metrics'?'campaign_id,date':'campaign_id,date,region');}}
 expect(writes.filter(w=>w.table==='campaign_metrics')[0].value[0]).toMatchObject({conversions:6,messaging_results:{total:4,whatsapp:3,direct:1}});
});
