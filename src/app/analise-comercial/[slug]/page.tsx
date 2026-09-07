import type { Metadata } from "next";
import { CommercialCollectionPublic } from "@/app/coleta/[slug]/CommercialCollectionPublic";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Análise Comercial | Genesy", robots: { index: false, follow: false } };

export default function CommercialAnalysisPublicPage({ params }: { params: { slug: string } }) {
  return <CommercialCollectionPublic slug={params.slug} />;
}
