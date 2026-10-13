import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCommercialAnalysisEmail, getResendClient } from "@/lib/resend";

type Delivery = { id: string; broker_id: string | null; recipient_email: string; attempts: number };

/** "sent" means accepted by Resend, not confirmed in the recipient's inbox. */
export async function sendCommercialEmail(db: SupabaseClient, input: {
  delivery: Delivery;
  collectionId: string;
  collectionName: string;
  clientName: string;
  analysisLink: string;
  deliveryType?: "manual" | "automatic";
}) {
  const { delivery } = input;
  let failure: string | null = null;
  try {
    const from = process.env.RESEND_FROM_EMAIL?.trim();
    if (!from || from.includes("@resend.dev")) throw new Error("Configure um remetente verificado em RESEND_FROM_EMAIL para enviar aos corretores.");
    const payload = {
      from,
      to: delivery.recipient_email.trim().toLowerCase(),
      subject: `Análise Comercial · ${input.clientName}`,
      html: buildCommercialAnalysisEmail(input),
      text: `Análise Comercial · ${input.clientName}\n\n${input.collectionName}\n\nPreencha sua análise comercial pelo link:\n${input.analysisLink}\n\nGenesy`,
    };
    // A correction to the address, sender or content must not reuse a stale request.
    const fingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);
    const { data, error } = await getResendClient().emails.send(payload, {
      idempotencyKey: `commercial-${input.collectionId}-${delivery.broker_id ?? delivery.id}-${fingerprint}`,
    });
    if (error) throw new Error(error.message);
    if (!data?.id) throw new Error("O provedor não confirmou o aceite do e-mail.");
    console.info("[commercial-email] accepted", { deliveryId: delivery.id, providerId: data.id });
  } catch (error) {
    failure = error instanceof Error ? error.message : "Falha ao enviar e-mail";
  }
  const { error: saveError } = await db.from("commercial_collection_deliveries").update({
    status: failure ? "failed" : "sent",
    attempts: Number(delivery.attempts) + 1,
    last_error: failure?.slice(0, 1000) ?? null,
    ...(failure ? {} : { sent_at: new Date().toISOString() }),
    ...(input.deliveryType ? { delivery_type: input.deliveryType } : {}),
  }).eq("id", delivery.id);
  if (saveError) throw new Error(`Não foi possível registrar o resultado do envio: ${saveError.message}`);
  return { accepted: failure === null };
}
