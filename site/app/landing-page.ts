import { readFile } from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { siteOgImage } from "./og-image";

// Landing pages em HTML estático (public/<pasta>/index.html), servidas por uma rota para
// trocar o og:image pelo banner escolhido no módulo Site Genesy do dashboard.
// Para carregar rápido: o HTML é enxugado, comprimido (Brotli/Gzip) uma vez só e mantido em memória.

type Entry = { key: string; raw: Uint8Array; br: Uint8Array; gz: Uint8Array };
const cache = new Map<string, Entry>();

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// Tira a indentação e as linhas em branco. As páginas não têm <pre> nem <textarea>, então é seguro.
const tidy = (html: string) => html.split("\n").map(line => line.trim()).filter(Boolean).join("\n");

async function build(folder: string, siteKey: string) {
  const image = await siteOgImage(siteKey);
  const key = image.url;
  const cached = cache.get(folder);
  if (cached && cached.key === key && process.env.NODE_ENV === "production") return cached;

  const html = await readFile(path.join(process.cwd(), "public", folder, "index.html"), "utf8");
  const tags = [
    `<meta property="og:image" content="${escape(image.url)}">`,
    `<meta property="og:image:width" content="${image.width}">`,
    `<meta property="og:image:height" content="${image.height}">`,
    `<meta name="twitter:image" content="${escape(image.url)}">`,
  ].join("\n");
  const page = tidy(html.replace(/<meta property="og:image"[^>]*>/, tags));
  const raw = new TextEncoder().encode(page);
  const entry: Entry = {
    key,
    raw,
    br: new Uint8Array(brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: raw.length } })),
    gz: new Uint8Array(gzipSync(raw, { level: 9 })),
  };
  cache.set(folder, entry);
  return entry;
}

export async function landingPage(request: Request, folder: string, siteKey: string) {
  const entry = await build(folder, siteKey);
  const accepts = request.headers.get("accept-encoding") ?? "";
  const headers: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=600",
    Vary: "Accept-Encoding",
  };
  if (/\bbr\b/.test(accepts)) return new Response(entry.br, { headers: { ...headers, "Content-Encoding": "br" } });
  if (/\bgzip\b/.test(accepts)) return new Response(entry.gz, { headers: { ...headers, "Content-Encoding": "gzip" } });
  return new Response(entry.raw, { headers });
}
