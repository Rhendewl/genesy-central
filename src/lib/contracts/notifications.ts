import type {SupabaseClient} from '@supabase/supabase-js';
import {persistOperationalAlert} from '@/lib/notifications/operational-alert';
/** Read committed evidence; never trust a submitted name/status for notifications. */
export async function notifyContractSignature(db:SupabaseClient,contractId:string,signerId:string) {
 const [{data:doc,error:docError},{data:signer,error:signerError}]=await Promise.all([
  db.from('client_contract_documents').select('id,user_id,title,status,client_id,client_data').eq('id',contractId).single(),
  db.from('client_contract_signers').select('id,signed_name,signed_at,contract_id').eq('id',signerId).eq('contract_id',contractId).single(),
 ]);
 if(docError || signerError)throw new Error('Não foi possível consultar a assinatura para notificar');
 if(!doc || !signer?.signed_at || signer.contract_id!==doc.id)return;
 const shared={ownerUserId:doc.user_id,recipientAuthUserId:doc.user_id,source:'client_contract',actionUrl:`/clientes?tab=contratos&contract=${encodeURIComponent(doc.id)}`};
 await persistOperationalAlert(db,{...shared,eventId:`contract-signature:${signer.id}`,title:`Contrato Assinado por ${signer.signed_name}`,body:`${doc.title} · Uma nova assinatura foi registrada.`});
 if(doc.status==='signed' && doc.client_id) {
  await persistOperationalAlert(db,{...shared,eventId:`contract-completed:${doc.id}`,title:`Contrato de ${doc.client_data?.name || 'Cliente'} Validado! Novo cliente adicionado!`,body:`Todas as assinaturas de ${doc.title} foram concluídas. O cliente já está na sua carteira.`});
 }
}
