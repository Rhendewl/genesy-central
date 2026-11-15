export function crmNotificationUrl(pipelineId?:string|null,leadId?:string|null) {
 const params=new URLSearchParams();if(pipelineId)params.set('pipeline',pipelineId);if(leadId)params.set('lead',leadId);
 return '/crm'+(params.size?'?'+params.toString():'');
}
/** The auth middleware preserves query parameters; resume only a local CRM URL. */
export function crmNotificationAfterLogin(search:string) {
 const params=new URLSearchParams(search);
 return params.get('pipeline') || params.get('lead') ? crmNotificationUrl(params.get('pipeline'),params.get('lead')) : '/';
}
