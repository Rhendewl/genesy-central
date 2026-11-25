import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ErroFerramenta } from "./protocol";

/** Só aceita https para endereços públicos (sem localhost nem IPs de rede interna). */
export function urlPublicaSegura(valor: string): URL {
  let url: URL;
  try { url = new URL(valor); } catch { throw new ErroFerramenta("URL inválida."); }
  if (url.protocol !== "https:") throw new ErroFerramenta("A URL precisa começar com https://.");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new ErroFerramenta("URL de rede interna não é aceita.");
  }
  if (isIP(host) && ipPrivado(host)) throw new ErroFerramenta("URL de rede interna não é aceita.");
  return url;
}

export function ipPrivado(ip: string): boolean {
  const v = ip.toLowerCase().replace(/^::ffff:/, "");
  return /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(v)
    || v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

/** Confere também para onde o nome aponta (evita domínio público que resolve para IP interno). */
export async function conferirDestino(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return;
  let enderecos: { address: string }[];
  try { enderecos = await lookup(host, { all: true }); } catch { throw new ErroFerramenta("Não encontrei o endereço do link."); }
  if (!enderecos.length || enderecos.some((e) => ipPrivado(e.address))) throw new ErroFerramenta("URL de rede interna não é aceita.");
}
