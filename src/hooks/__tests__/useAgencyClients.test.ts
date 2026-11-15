import {act,createElement} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({rows:[{id:'client',name:'Teste'}],error:null as {message:string}|null,empty:false,hold:false,release:undefined as undefined|((r:unknown)=>void)}));
vi.mock('@/lib/supabase',()=>({getSupabaseClient:()=>({from:()=>({
 select:()=>({order:()=>{if(mocks.hold){mocks.hold=false;return new Promise(resolve=>{mocks.release=resolve;});}return Promise.resolve({data:[...mocks.rows],error:null});}}),
 delete:()=>({eq:(_key:string,id:string)=>({select:async()=>{if(mocks.error)return {data:null,error:mocks.error};if(mocks.empty)return{data:[],error:null};mocks.rows=mocks.rows.filter(r=>r.id!==id);return{data:[{id}],error:null};}})}),
})})}));
import {useAgencyClients} from '../useAgencyClients';
let root:Root,host:HTMLDivElement;
const apis:ReturnType<typeof useAgencyClients>[]=[];
function Consumer({slot}:{slot:number}){const api=useAgencyClients();apis[slot]=api;return createElement('span',{},api.clients.map(c=>c.name).join(','));}
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});mocks.rows=[{id:'client',name:'Teste'}];mocks.error=null;mocks.empty=false;mocks.hold=false;mocks.release=undefined;apis.length=0;host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
describe('confirmed client deletion',()=>{
 it('updates other mounted client lists immediately and ignores a stale load response',async()=>{
  await act(async()=>root.render(createElement('div',{},createElement(Consumer,{slot:0}),createElement(Consumer,{slot:1}))));
  mocks.hold=true;let stale:Promise<void>;
  await act(async()=>{stale=apis[0].refetch();});
  await act(async()=>{expect(await apis[0].deleteClient('client')).toEqual({error:null});});
  expect(apis[0].clients).toHaveLength(0);expect(apis[1].clients).toHaveLength(0);
  await act(async()=>{mocks.release?.({data:[{id:'client',name:'Resposta antiga'}],error:null});await stale!;});
  expect(apis[0].clients).toHaveLength(0);expect(apis[0].isLoading).toBe(false);
 });
 it('does not pretend success or remove the row when the server refuses deletion',async()=>{
  await act(async()=>root.render(createElement(Consumer,{slot:0})));
  mocks.error={message:'Vínculo impede a exclusão'};
  await act(async()=>{expect((await apis[0].deleteClient('client')).error).toBe('Vínculo impede a exclusão');});expect(apis[0].clients).toHaveLength(1);
  mocks.error=null;mocks.empty=true;
  await act(async()=>{expect((await apis[0].deleteClient('client')).error).toContain('sem permissão');});expect(apis[0].clients).toHaveLength(1);
 });
});
