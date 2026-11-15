export const CLIENTS_CHANGED='agency-clients:changed';
export function notifyClientsChanged(id:string,kind:'created'|'updated'|'deleted') {
 window.dispatchEvent(new CustomEvent(CLIENTS_CHANGED,{detail:{id,kind}}));
}
export function clientError(error:unknown,fallback:string) {
 if(error && typeof error==='object' && 'code' in error && error.code==='23503')return 'Este cliente possui vínculos que impedem a exclusão.';
 return error && typeof error==='object' && 'message' in error && typeof error.message==='string' ? error.message : fallback;
}
