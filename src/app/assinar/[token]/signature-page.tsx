"use client";
import { ContractPaper } from "@/components/clientes/ContractPaper";
import type { ContractSigner } from "@/lib/contracts/model";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FileSignature, Loader2 } from "lucide-react";
import { downloadContract } from "@/lib/contracts/pdf";
import { signatureChoices, signatureFonts, signatureStyle, signerRoles } from "@/lib/contracts/signature-styles";
import "@/components/clientes/contracts.css";
interface SignatureData {
  document: {
    id: string;
    title: string;
    body: string;
    content_hash: string;
    status: string;
    expires_at: string;
  };
  signer: { requires_email_verification: boolean; document: string; name: string; signed_at: string | null };
  signers: ContractSigner[];
  consent: string;
}
export function SignaturePage({ token }: { token: string }) {
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [style, setStyle] = useState(1);
  const [data, setData] = useState<SignatureData | null>(null),
    [error, setError] = useState(""),
    [name, setName] = useState(""),
    [document, setDocument] = useState(""),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const load = useCallback(async (prefill = true) => {
    const r = await fetch(`/api/public/assinaturas/${token}`, {
      cache: "no-store",
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    setData(j);
    if (prefill) { setName(j.signer.name); setDocument(j.signer.document ?? ""); }
  }, [token]);
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(() => {
    let running=false;
    const refresh=()=>{if(window.document.visibilityState === "hidden" || running) return; running=true;void load(false).catch(()=>{}).finally(()=>{running=false;});};
    const timer=window.setInterval(refresh,4000);window.addEventListener("focus",refresh);
    return ()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[load]);
  async function sign(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/public/assinaturas/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          style,
          code,
          document,
          consent,
          content_hash: data?.document.content_hash,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível assinar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="contract-public">
      <div className="contract-public-shell">
        <header className="contract-public-brand">
          <Image src="/genesy-logoname.svg" alt="Genesy" width={150} height={34} />
          <span className="contract-public-caption">ASSINATURA DE CONTRATOS</span>
        </header>
        {loading ? (
          <div className="contract-box">
            <Loader2 className="animate-spin" />
            Carregando contrato…
          </div>
        ) : (
          <>
            {error && (
              <p role="alert" className="contract-error">
                {error}
              </p>
            )}
            {data && (
              <>
                <header className="contract-box">
                  <span className="contract-kicker">
                    DOCUMENTO PARA ASSINATURA
                  </span>
                  <h1>{data.document.title}</h1>
                  <p>Preparado para {data.signer.name}</p>
                  <small>
                    Link individual e privado · Validade até{" "}
                    {new Date(data.document.expires_at).toLocaleDateString(
                      "pt-BR",
                    )}
                  </small>
                </header>
                <ContractPaper document={{...data.document,signers:data.signers}} />
                <button
                  className="contract-print"
                  onClick={() => { void load().then(async ()=>{ const r=await fetch(`/api/public/assinaturas/${token}`,{cache:"no-store"}); const latest=await r.json(); if(r.ok) await downloadContract({...latest.document,signers:latest.signers}); }).catch(e=>setError(e.message)); }}
                >
                  Baixar PDF atualizado
                </button>
                {data.signer.signed_at ? (
                  <section className="contract-box contract-success">
                    <CheckCircle2 size={32} />
                    <h2>Sua assinatura foi registrada</h2>
                    <p>
                      {data.document.status === "signed"
                        ? "Todas as assinaturas foram concluídas."
                        : "Aguardando os demais assinadores para concluir o contrato."}
                    </p>
                  </section>
                ) : (
                  <form className="contract-box contract-form" onSubmit={sign}>
                    <h2>Assinar contrato</h2>
                    <p>
                      Confira todo o documento antes de confirmar. O acesso a
                      este link identifica o convite; informe seus próprios
                      dados para registrar o aceite.
                    </p>
                    <label className="contract-field">
                      <span>Seu nome completo</span>
                      <input
                        required
                        autoComplete="name"
                        value={name}
                        maxLength={200}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <label className="contract-field">
                      <span>Seu CPF / CNPJ</span>
                      <input
                        required
                        inputMode="numeric"
                        value={document}
                        maxLength={30}
                        onChange={(e) => setDocument(e.target.value)}
                      />
                    </label>
                    {data.signer.requires_email_verification ? <div className="contract-box"><h3>Valide seu e-mail</h3><p>Enviaremos um código ao e-mail cadastrado no convite para confirmar seu acesso.</p><button type="button" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{const r=await fetch(`/api/public/assinaturas/${token}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"send_code"})});const j=await r.json();if(!r.ok)throw new Error(j.error);setCodeSent(true);}catch(e){setError(e instanceof Error?e.message:"Falha ao enviar código");}finally{setBusy(false);}}}>{codeSent?"Reenviar código":"Enviar código por e-mail"}</button>{codeSent && <label className="contract-field"><span>Código recebido por e-mail</span><input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,""))}/></label>}</div> : <p>Este convite utiliza o link privado para registrar seu aceite, sem validação por e-mail. Nome, CPF/CNPJ, horário e dados técnicos de acesso serão associados à assinatura.</p>}
                    <fieldset className="contract-signature-options"><legend>Escolha sua assinatura</legend>{signatureChoices.map(choice=><label key={choice.style}><input type="radio" name="signature-style" checked={style===choice.style} onChange={()=>setStyle(choice.style)} /><small className="contract-font-label">{choice.label}</small><span style={{fontFamily:choice.font,fontSize:Math.max(18,Math.min(38,540/(name.trim().length || 8)))}}>{name || "Seu nome"}</span></label>)}</fieldset>
                    <label className="contract-consent">
                      <input
                        type="checkbox"
                        required
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      <span>{data.consent}</span>
                    </label>
                    <button
                      className="contract-primary"
                      disabled={busy || !consent || (data.signer.requires_email_verification && (!codeSent || code.length !== 6))}
                    >
                      {busy ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <FileSignature size={18} />
                      )}{" "}
                      {busy ? "Registrando…" : "Confirmar e assinar contrato"}
                    </button>
                  </form>
                )}
                <details className="contract-box contract-public-signers">
                  <summary>Assinadores · {data.signers.filter(s=>s.signed_at).length} de {data.signers.length} assinaturas</summary><button type="button" onClick={()=>void load().catch(e=>setError(e.message))}>Atualizar assinaturas</button>
                  {data.signers.map((s, i) => (
                    <div className="contract-signature-item" key={i}>
                      <span>
                        {s.signed_at && <span className="contract-handwriting" style={{fontFamily:signatureFonts[signatureStyle(s.consent_text)]}}>{s.signed_name || s.name}</span>}
                        {s.signed_name || s.name}
                        <small className="block">{signerRoles[s.role] || s.role}</small>
                      </span>
                      <span>
                        {s.signed_at
                          ? `Assinado · ${new Date(s.signed_at).toLocaleString("pt-BR")}`
                          : "Aguardando"}
                      </span>
                    </div>
                  ))}
                </details>
                <footer className="contract-hash">
                  Identificação do documento · SHA-256
                  <br />
                  {data.document.content_hash}
                </footer>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
