// Banner de visualização do link (og:image) escolhido no módulo Site Genesy do dashboard.
// Se o dashboard não responder, usa a imagem padrão do site.
export const DEFAULT_OG_IMAGE = { url: "https://genesycompany.com/og.png", width: 1536, height: 914 };

export async function siteOgImage(siteKey: string) {
  try {
    const response = await fetch(`https://dash.genesycompany.com/api/site/${siteKey}/config`, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return DEFAULT_OG_IMAGE;
    const config = await response.json() as { og_image_url?: string | null };
    // Os banners enviados pelo dashboard já saem em 1200×630.
    return config.og_image_url ? { url: config.og_image_url, width: 1200, height: 630 } : DEFAULT_OG_IMAGE;
  } catch {
    return DEFAULT_OG_IMAGE;
  }
}
