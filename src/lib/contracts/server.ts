import { createHash, createHmac } from "node:crypto";
export function contentHash(text: string) {
  return createHash("sha256").update(text).digest("hex");
}
export function signerToken(id: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Assinaturas não configuradas");
  return createHmac("sha256", secret)
    .update(`client-contract-signature:v1:${id}`)
    .digest("hex");
}
export function signingUrl(id: string) {
  return `https://go.genesycompany.com/assinar/${signerToken(id)}`;
}
