import { notifyContractSignature } from "@/lib/contracts/notifications";
import { randomInt } from "node:crypto";
import { getResendClient } from "@/lib/resend";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { contentHash } from "@/lib/contracts/server";
import { CONSENT, requiredText } from "@/lib/contracts/model";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
async function lookup(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const db = createAdminSupabaseClient();
  const { data: signer } = await db
    .from("client_contract_signers")
    .select("id,contract_id,name,email,role,signed_at")
    .eq("token_hash", contentHash(token))
    .maybeSingle();
  if (!signer) return null;
  const { data: doc } = await db
    .from("client_contract_documents")
    .select("id,title,body,content_hash,status,expires_at,completed_at,client_data")
    .eq("id", signer.contract_id)
    .single();
  if (
    !doc ||
    doc.status === "cancelled" ||
    new Date(doc.expires_at).getTime() < Date.now()
  )
    return null;
  return { db, signer, doc };
}
export async function GET(
  _: NextRequest,
  { params }: { params: { token: string } },
) {
  const found = await lookup(params.token);
  if (!found)
    return NextResponse.json(
      { error: "Link inválido, expirado ou contrato cancelado" },
      { status: 404, headers },
    );
  const { data: signers } = await found.db
    .from("client_contract_signers")
    .select("id,name,role,signed_at,signed_name,signed_document,consent_text,ip")
    .eq("contract_id", found.doc.id);
  return NextResponse.json(
    {
      document: { ...found.doc, client_data: undefined },
      signer: { name: found.signer.name === "Testemunha" ? "" : found.signer.name, signed_at: found.signer.signed_at, requires_email_verification: Boolean(found.signer.email?.trim()), document: found.doc.client_data?.signer_documents?.[found.signer.id] ?? "" },
      signers: (signers ?? []).map(s=>({...s,expected_document:found.doc.client_data?.signer_documents?.[s.id] ?? ""})),
      consent: CONSENT,
    },
    { headers },
  );
}
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    const found = await lookup(params.token);
    if (!found)
      return NextResponse.json(
        { error: "Link inválido, expirado ou contrato cancelado" },
        { status: 404, headers },
      );
    const b = await req.json();
    if (found.signer.signed_at) throw new Error("Esta assinatura já foi registrada");
    if (b.action === "send_code") {
      if (!found.signer.email?.trim()) throw new Error("Este convite não possui e-mail cadastrado; assine pelo link privado");
      const code = String(randomInt(100000, 1000000));
      const { data: allowed, error: challengeError } = await found.db.rpc("request_contract_signature_code", {p_signer: found.signer.id, p_hash: contentHash(`${params.token}:${code}`)});
      if (challengeError) throw new Error("Verificação de e-mail indisponível. Confira a migração de validação de assinaturas.");
      if (!allowed) throw new Error("Aguarde um minuto antes de solicitar outro código");
      const {error: mailError} = await getResendClient().emails.send({ from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev", to: found.signer.email, subject: "Código para assinar seu contrato Genesy", text: `Seu código é ${code}. Válido por 10 minutos. Se não solicitou, ignore esta mensagem.` });
      if (mailError) throw new Error("Não foi possível enviar o código. Tente novamente em um minuto.");
      return NextResponse.json({ok:true}, {headers});
    }
    if (b.consent !== true)
      throw new Error("Confirme a leitura e o aceite do contrato");
    const name = requiredText(b.name, "Nome completo");
    const document = requiredText(b.document, "CPF/CNPJ", 30);
    if (![11, 14].includes(document.replace(/\D/g, "").length))
      throw new Error("Informe um CPF ou CNPJ com 11 ou 14 dígitos");
    if (b.content_hash !== found.doc.content_hash)
      throw new Error("Recarregue o contrato antes de assinar");
    const requiresEmail = Boolean(found.signer.email?.trim());
    if (requiresEmail) {
    if (!/^\d{6}$/.test(b.code ?? "")) throw new Error("Informe o código de seis dígitos enviado ao seu e-mail");
    const {data: verified, error: verifyError} = await found.db.rpc("verify_contract_signature_code", {p_signer: found.signer.id, p_hash: contentHash(`${params.token}:${b.code}`)});
    if (verifyError || !verified) throw new Error("Código inválido ou expirado. Solicite um novo código.");
    }
    const { data, error } = await found.db.rpc("sign_client_contract", {
      p_token_hash: contentHash(params.token),
      p_content_hash: b.content_hash,
      p_name: name,
      p_document: document,
      p_consent: CONSENT + ` ${requiresEmail ? "E-mail do convite verificado por código." : "Aceite pelo link privado, sem verificação de e-mail."} Estilo de assinatura: ${[0,1,2,3,4,5].includes(b.style) ? b.style : 0}.`,
      p_ip: (
        req.headers.get("x-vercel-forwarded-for") ??
        req.headers.get("x-forwarded-for") ??
        ""
      )
        .split(",")[0]
        .slice(0, 100),
      p_agent: (req.headers.get("user-agent") ?? "").slice(0, 500),
    });
    if (error)
      throw new Error(
        "Não foi possível assinar. Atualize a página e confira se o contrato ainda está disponível.",
      );
    // Notification retries are deduplicated by the persisted event/recipient key.
    // A notification transport error must never invalidate a committed signature.
    for(let attempt=0;attempt<2;attempt++) {
      try {await notifyContractSignature(found.db,found.doc.id,found.signer.id);break;}
      catch {if(attempt===1) console.error("[contracts] Falha ao registrar notificação de assinatura",found.signer.id);}
    }
    return NextResponse.json({ ok: true, ...data }, { headers });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha na assinatura" },
      { status: 400, headers },
    );
  }
}
