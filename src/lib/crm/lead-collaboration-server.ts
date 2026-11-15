import {NextResponse} from "next/server";
import {createServerSupabaseClient} from "@/lib/supabase-server";
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function fail(message:string,status=400):never {throw Object.assign(new Error(message),{status});}
export async function leadContext(id:string){
 if(!UUID.test(id))fail("Lead inválido.");
 const db=await createServerSupabaseClient();const {data:{user}}=await db.auth.getUser();
 if(!user)fail("Faça login novamente.",401);
 const lead=await db.from("leads").select("id,user_id,name").eq("id",id).maybeSingle();
 if(lead.error)fail("Não foi possível consultar o lead.",500);
 if(!lead.data)fail("Lead não encontrado ou sem acesso.",404);
 const profile=await db.from("user_profiles").select("id,full_name,avatar_url").eq("auth_user_id",user!.id).eq("owner_id",lead.data.user_id).eq("is_active",true).maybeSingle();
 if(profile.error||!profile.data)fail("Seu perfil não tem acesso ativo a este CRM.",403);
 return {db,user:user!,lead:lead.data,profile:profile.data!};
}
export async function smallBody(req:Request){
 const text=await req.text();if(text.length>16000)fail("Conteúdo muito grande.",413);
 try{return JSON.parse(text) as Record<string,unknown>;}catch{fail("Dados inválidos.");}
}
export function collaborationError(e:unknown){
 const status=typeof e==="object"&&e&&"status"in e&&typeof e.status==="number"?e.status:500;
 return NextResponse.json({error:status===500?"Não foi possível concluir. Seu conteúdo foi preservado; tente novamente.":e instanceof Error?e.message:"Falha ao concluir."},{status,headers:{"Cache-Control":"no-store"}});
}
export const privateHeaders={"Cache-Control":"private, no-store"};
export function safeAvatar(value:unknown){try{const u=new URL(String(value));return u.protocol==="https:"&&!u.username&&!u.password?u.href:null;}catch{return null;}}
