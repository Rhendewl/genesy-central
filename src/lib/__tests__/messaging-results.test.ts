import {expect,it} from 'vitest';
import {classifyMessaging,messagingCards,summarizeMessaging} from '../messaging-results';
import {aggregateTrafficReport} from '../traffic-report';
it('keeps mixed destinations unknown and never infers a channel from a placement or name',()=>{
 const result=classifyMessaging(10,[{count:3,destination:'WHATSAPP'},{count:2,destination:'INSTAGRAM_DIRECT'},{count:5,destination:'MESSAGING_INSTAGRAM_DIRECT_WHATSAPP'}]);
 expect(result).toEqual({total:10,whatsapp:3,direct:2,messenger:0,unclassified:5});
 expect(messagingCards(result).map(x=>x.key)).toEqual(['total','whatsapp','direct','unclassified']);
});
it('preserves the canonical campaign total when adset attribution is inconsistent',()=>{
 expect(classifyMessaging(2,[{count:3,destination:'WHATSAPP'}])).toEqual({total:2,whatsapp:0,direct:0,messenger:0,unclassified:2});
});
it('does not show empty or unavailable conversation metrics',()=>{
 expect(messagingCards(summarizeMessaging([{messaging_results:null}]))).toEqual([]);
 expect(messagingCards(null)).toEqual([]);
});
it('sums report channel counts within selected metrics without adding them again to leads',()=>{
 const common={campaign_id:'a',spend:100,leads:8,impressions:1000,reach:800,clicks:50,conversions:8};
 const report=aggregateTrafficReport({clientName:'Teste',since:'2026-11-01',until:'2026-11-03',campaigns:[{id:'a',name:'Teste',status:'ativa'}],metrics:[{...common,messaging_results:classifyMessaging(4,[{count:3,destination:'WHATSAPP'},{count:1,destination:'INSTAGRAM_DIRECT'}])},{...common,messaging_results:classifyMessaging(2,[])}]});
 expect(report.metrics.leads).toBe(16);expect(report.metrics.messaging_results).toEqual({total:6,whatsapp:3,direct:1,messenger:0,unclassified:2});
});
