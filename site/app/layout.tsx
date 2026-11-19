import type { Metadata } from "next";
import "./globals.css";

const title = "Genesy Inteligência Imobiliária";
const description =
  "Estratégia imobiliária, leads qualificados e capacitação comercial para transformar anúncios em vendas reais.";

export const metadata: Metadata = {
  metadataBase: new URL("https://genesycompany.com"),
  title,
  description,
  icons: { icon: "/g-cinza.png", shortcut: "/g-cinza.png" },
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: "/og.png", width: 1536, height: 914, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
