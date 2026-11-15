import {beforeEach,describe,it,expect,vi} from 'vitest';
import {notifyContractSignature} from '../notifications';
import {persistOperationalAlert} from '@/lib/notifications/operational-alert';
vi.mock('@/lib/notifications/operational-alert',()=>({persistOperationalAlert:vi.fn()}));
const alert=vi.mocked(persistOperationalAlert);
function dbFor(status='pending',clientId:string|null=null,signedAt:string|null='2026-11-06T16:00:00Z') {
 const db={from:(table:string)=>{const data=table==='client_contract_documents'?{id:'contract',user_id:'owner',title:'Prestação de serviços',status,client_id:clientId,client_data:{name:'Cliente Exemplo'}}:{id:'witness',contract_id:'contract',signed_name:'Maria Silva',signed_at:signedAt};const q={select:()=>q,eq:()=>q,single:async()=>({data,error:null})};return q;}};return db;
}
beforeEach(()=>{vi.clearAllMocks();alert.mockResolvedValue({recipients:1,created:1,accepted:1,failed:0,noSubscription:0});});
describe('contract owner notifications',()=>{
 it('notifies the owner using the recorded signer name and a private internal destination',async()=>{
  const db=dbFor();await notifyContractSignature(db as never,'contract','witness');
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledWith(db,expect.objectContaining({ownerUserId:'owner',recipientAuthUserId:'owner',eventId:'contract-signature:witness',title:'Contrato Assinado por Maria Silva',actionUrl:'/clientes?tab=contratos&contract=contract'}));
 });
 it('also announces completion only after all signatures and client creation',async()=>{
  await notifyContractSignature(dbFor('signed','client-id') as never,'contract','witness');
  expect(alert).toHaveBeenCalledTimes(2);
  expect(alert.mock.calls[1][1]).toMatchObject({eventId:'contract-completed:contract',title:'Contrato de Cliente Exemplo Validado! Novo cliente adicionado!',recipientAuthUserId:'owner'});
 });
 it('does not claim client creation without a persisted client, or notify an unsigned record',async()=>{
  await notifyContractSignature(dbFor('signed') as never,'contract','witness');expect(alert).toHaveBeenCalledTimes(1);
  alert.mockClear();await notifyContractSignature(dbFor('pending',null,null) as never,'contract','witness');expect(alert).not.toHaveBeenCalled();
 });
});
