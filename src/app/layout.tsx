import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers }        from "@/components/layout/Providers";
import { AuthLayout }       from "@/components/layout/AuthLayout";
import { PlatformLoader }   from "@/components/layout/PlatformLoader";
import { PwaRegistration }  from "@/components/layout/PwaRegistration";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "Genesy | Dashboard",
  description: "Plataforma operacional integrada: CRM, Financeiro e Tráfego Pago",
  manifest: "/manifest.json",
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans antialiased`}>
        {/* SVG gradient defs for icon gradient — referenced globally via url(#icon-gradient) */}
        <svg aria-hidden="true" focusable="false" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
          <defs>
            <linearGradient id="icon-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#9a9a9a" />
            </linearGradient>
          </defs>
        </svg>
        <PwaRegistration />
        <PlatformLoader />
        <Providers>
          <AuthLayout>{children}</AuthLayout>
        </Providers>
      </body>
    </html>
  );
}
