import { readFile } from "node:fs/promises";
import path from "node:path";
import { siteOgImage } from "../og-image";

// Landing "Scripts Imobiliários": HTML estático com o banner do link (og:image) escolhido no dashboard.
export const dynamic = "force-dynamic";

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export async function GET() {
  const [html, image] = await Promise.all([
    readFile(path.join(process.cwd(), "public/scripts/index.html"), "utf8"),
    siteOgImage("scripts-imobiliarios"),
  ]);
  const tags = [
    `<meta property="og:image" content="${escape(image.url)}">`,
    `<meta property="og:image:width" content="${image.width}">`,
    `<meta property="og:image:height" content="${image.height}">`,
    `<meta name="twitter:image" content="${escape(image.url)}">`,
  ].join("\n");
  const page = html.replace(/<meta property="og:image"[^>]*>/, tags);
  return new Response(page, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
