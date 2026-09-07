const configuredPublicOrigin = process.env.NEXT_PUBLIC_PUBLIC_SITE_URL?.trim();

export const PUBLIC_SITE_ORIGIN = (configuredPublicOrigin || "https://go.genesycompany.com").replace(/\/$/, "");

export function buildPublicUrl(path: string) {
  return `${PUBLIC_SITE_ORIGIN}/${path.replace(/^\//, "")}`;
}
