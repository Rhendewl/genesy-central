import {afterEach,expect,it,vi} from 'vitest';
import {getMessagingBreakdown,type MetaInsightRow} from '../meta-api';
afterEach(()=>vi.unstubAllGlobals());
const actions=(value:string)=>[{action_type:'onsite_conversion.messaging_conversation_started_7d',value}];
it('reads paginated official destinations and keeps multi-app conversations unclassified',async()=>{
 const fetcher=vi.fn(async(url:string)=>{
  const parsed=new URL(url);
  const data=parsed.pathname.endsWith('/adsets')?{data:[{id:'wa',destination_type:'WHATSAPP'}],paging:{next:'https://graph.facebook.com/destination-page-2'}}:parsed.pathname==='/destination-page-2'?{data:[{id:'ig',destination_type:'INSTAGRAM_DIRECT'},{id:'multi',destination_type:'MESSAGING_INSTAGRAM_DIRECT_WHATSAPP'}]}:{data:[{adset_id:'wa',campaign_id:'c',date_start:'2026-11-04',actions:actions('3')},{adset_id:'ig',campaign_id:'c',date_start:'2026-11-04',actions:actions('2')},{adset_id:'multi',campaign_id:'c',date_start:'2026-11-04',actions:actions('1')}]};
  return new Response(JSON.stringify(data),{status:200});
 });vi.stubGlobal('fetch',fetcher);
 const result=await getMessagingBreakdown('act_1','test','2026-11-04','2026-11-04',[{campaign_id:'c',date_start:'2026-11-04',actions:actions('6')} as MetaInsightRow]);
 expect(result.get('c:2026-11-04')).toEqual({total:6,whatsapp:3,direct:2,messenger:0,unclassified:1});expect(fetcher).toHaveBeenCalledTimes(3);
});
it('does not fetch channel breakdowns when no conversations exist',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);expect(await getMessagingBreakdown('act_1','test','2026-11-04','2026-11-04',[])).toEqual(new Map());expect(fetcher).not.toHaveBeenCalled();
});
