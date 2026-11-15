export interface MessagingResults {
 total: number;
 whatsapp: number;
 direct: number;
 messenger: number;
 unclassified: number;
}
export const emptyMessagingResults = (): MessagingResults => ({total:0,whatsapp:0,direct:0,messenger:0,unclassified:0});
export function summarizeMessaging(rows: {messaging_results?: MessagingResults | null}[]): MessagingResults {
 return rows.reduce((sum,row)=>{const value=row.messaging_results;if(value) for(const key of Object.keys(sum) as (keyof MessagingResults)[]) sum[key] += Math.max(0,Number(value[key])||0);return sum;},emptyMessagingResults());
}
/** Use only single-app destinations supplied by Meta. Mixed/unknown destinations remain unclassified. */
export function classifyMessaging(total: number, rows: {count:number;destination?:string}[]): MessagingResults {
 const result=emptyMessagingResults();result.total=total;
 for(const row of rows) {const key=row.destination === "WHATSAPP" ? "whatsapp" : row.destination === "INSTAGRAM_DIRECT" ? "direct" : row.destination === "MESSENGER" ? "messenger" : null;if(key)result[key]+=row.count;}
 // Attribution can differ across reporting levels. Never scale or invent a split.
 if(result.whatsapp+result.direct+result.messenger > total) result.whatsapp=result.direct=result.messenger=0;
 result.unclassified=total-result.whatsapp-result.direct-result.messenger;return result;
}
export function messagingCards(data?: MessagingResults | null) {
 if(!data || data.total <= 0)return [];
 return [
  {key:"total",label:"Conversas iniciadas",value:data.total,color:"#38bdf8",description:"Já incluídas nos leads totais"},
  {key:"whatsapp",label:"WhatsApp",value:data.whatsapp,color:"#22c55e",description:"Conversas · destino WhatsApp"},
  {key:"direct",label:"Instagram Direct",value:data.direct,color:"#38bdf8",description:"Conversas · destino Direct"},
  {key:"messenger",label:"Messenger",value:data.messenger,color:"#60a5fa",description:"Conversas · destino Messenger"},
  {key:"unclassified",label:"Sem canal identificado",value:data.unclassified,color:"#aeb6c4",description:"Meta não discriminou o destino"},
 ].filter(metric=>metric.value > 0);
}
