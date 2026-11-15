"use client";
import { contractMainText } from '@/lib/contracts/presentation';
import Image from 'next/image';
import type { ContractSigner } from '@/lib/contracts/model';
import { signatureFonts, signatureStyle, signerRoles } from '@/lib/contracts/signature-styles';
export interface ContractPaperData { id?:string;title:string;body:string;content_hash?:string;signers?:Partial<ContractSigner>[] }
export function ContractPaper({document:doc}:{document:ContractPaperData}) {
 return <article className="contract-paper contract-document">
  <header className="contract-document-header"><Image src="/genesy-logoname.svg" alt="Genesy" width={170} height={38}/><span>DOCUMENTO CONTRATUAL<small>{doc.id ? `ID ${doc.id}` : 'Prévia do documento'}</small></span></header>
  <h2 className="contract-document-title">{doc.title}</h2>
  <div className="contract-document-body">{doc.signers?.length ? contractMainText(doc.body) : doc.body}</div>
  {!!doc.signers?.length && <section className="contract-document-signatures"><h3>Assinaturas eletrônicas</h3>{doc.signers.map((s,i)=><div className="contract-signing-line" key={s.id || i}>
    <div className="contract-signing-person"><strong>{s.signed_name || s.name || signerRoles[s.role || '']}</strong><span>{signerRoles[s.role || '']}</span>{(s.signed_document || s.expected_document) && <span>CPF/CNPJ: {s.signed_document || s.expected_document}</span>}</div>
    {s.signed_at ? <div className="contract-signing-seal"><Image src="/g-cinza.svg" alt="" width={28} height={28}/><div><span className="contract-seal-handwriting" style={{fontFamily:signatureFonts[signatureStyle(s.consent_text)]}}>{s.signed_name || s.name}</span><small>Assinado eletronicamente</small><small>ID do documento: {doc.id}</small><small>Código da assinatura: {s.id}</small><small>{new Date(s.signed_at).toLocaleString('pt-BR',{timeZone:'America/Fortaleza'})}</small></div></div> : <span className="contract-seal-pending">Aguardando assinatura</span>}
  </div>)}</section>}
  {doc.content_hash && <footer className="contract-document-hash">Identificação do conteúdo · SHA-256<br/>{doc.content_hash}</footer>}
 </article>;
}
