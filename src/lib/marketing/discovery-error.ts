export type DiscoveryIssue="rate_limit"|"credentials"|"permission"|"configuration"|"profile_unavailable"|"temporary"|"rejected";
export class DiscoveryError extends Error{
 constructor(message:string,public status:number,public kind:DiscoveryIssue,public metaCode?:number,public metaSubcode?:number,public diagnostic?:string){super(message);this.name="DiscoveryError";}
}
export function metaDiscoveryError(httpStatus:number,error:Record<string,unknown>|undefined,token:string){
 const code=typeof error?.code==="number"?error.code:undefined,sub=typeof error?.error_subcode==="number"?error.error_subcode:undefined;
 const raw=typeof error?.message==="string"?error.message:"";
 const diagnostic=raw.replaceAll(token,"[redacted]").replace(/https?:\/\/\S+/gi,"[url]").replace(/access_token\s*[=:]\s*\S+/gi,"access_token=[redacted]").slice(0,500);
 const suffix=code===undefined?"":` (Meta ${code}${sub===undefined?"":`/${sub}`})`;
 const make=(message:string,status:number,kind:DiscoveryIssue)=>new DiscoveryError(message+suffix,status,kind,code,sub,diagnostic);
 if(httpStatus===429||[4,17,32,613,80004].includes(code??-1))return make("Limite de consultas da Meta atingido. A coleta foi adiada por 24 horas.",429,"rate_limit");
 if([190,102].includes(code??-1))return make("A credencial da conexão de concorrentes expirou ou foi recusada. O administrador precisa renovar o acesso via Facebook Login.",503,"credentials");
 if([10,200,294].includes(code??-1))return make("A conexão não tem permissão para esta consulta. O administrador precisa revisar o acesso do aplicativo e da conta profissional na Meta.",403,"permission");
 if(code===100&&/nonexisting field.*business_discovery|node type.*\bUser\b|invalid.*version|unsupported.*version/i.test(raw))return make("A configuração da conta de origem ou da versão da consulta precisa ser revisada pelo administrador.",503,"configuration");
 if([100,110,803].includes(code??-1)&&/username|user.*not.*found|not.*exist|cannot.*find|cannot.*access.*user|invalid user|unsupported get request|not available|not allowed|does not support this operation/i.test(raw))return make("Este perfil não está disponível na consulta oficial. Confira o @ e se a conta é profissional e pública; restrições do próprio perfil também podem impedir a consulta.",404,"profile_unavailable");
 if(httpStatus>=500||error?.is_transient===true)return make("A Meta está indisponível para esta consulta. Tente novamente na próxima janela de coleta.",502,"temporary");
 return make("A Meta recusou esta consulta. Confira o perfil e peça ao administrador para verificar o código de diagnóstico.",422,"rejected");
}
export function discoveryIssue(error:unknown){return error instanceof DiscoveryError?{kind:error.kind,metaCode:error.metaCode,metaSubcode:error.metaSubcode}:{};}
