import type { NextRequest } from "next/server";

/**
 * Endereço público da plataforma para a requisição atual (ex.: https://dash.genesycompany.com).
 *
 * Atrás do proxy do servidor (Coolify/Traefik), `req.nextUrl.origin` vira o endereço interno
 * do container (https://localhost:3000). Esse valor não pode ir para OAuth (Meta, Instagram,
 * Google) nem ser usado para comparar a origem do navegador. Aqui usamos o host que o proxy
 * repassa e, se ele faltar, a variável NEXT_PUBLIC_APP_URL.
 */
export function requestOrigin(req: NextRequest | Request): string {
  const headers = req.headers;
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host")?.trim();
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (host && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(host)) return `${proto}://${host}`;
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(req.url).origin;
}
