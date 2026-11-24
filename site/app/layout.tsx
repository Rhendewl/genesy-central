import type { Metadata } from "next";
import "./globals.css";
import { siteOgImage } from "./og-image";

const title = "Genesy Inteligência Imobiliária";
const description =
  "Estratégia imobiliária, leads qualificados e capacitação comercial para transformar anúncios em vendas reais.";

export async function generateMetadata(): Promise<Metadata> {
  const image = await siteOgImage("genesycompany");
  return {
    metadataBase: new URL("https://genesycompany.com"),
    title,
    description,
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/icon.png", type: "image/png", sizes: "512x512" },
      ],
      shortcut: "/favicon.ico",
      apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: "https://genesycompany.com",
      images: [{ url: image.url, width: image.width, height: image.height, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
