import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicFormBySlug } from "@/lib/forms/public-form";
import { FormPublicClient } from "./FormPublicClient";

// Formulários publicados recebem picos de tráfego vindos de anúncios. Uma janela
// curta permite servir o HTML na borda sem consultar o banco a cada clique, sem
// deixar publicações e edições antigas por mais de alguns segundos.
export const revalidate = 15;
export const dynamicParams = true;

// Os slugs são criados pelos clientes em tempo de execução. A lista vazia faz
// o Next gerar cada um sob demanda e, depois, reutilizar a página via ISR.
export function generateStaticParams() {
  return [];
}

type PageProps = { params: { slug: string } };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const form = await getPublicFormBySlug(params.slug);
  if (!form) return { title: "Formulário não encontrado | Genesy" };
  return {
    title: `${form.name || "Formulário"} | Genesy`,
    description: form.description || "Preencha este formulário criado com Genesy.",
    robots: { index: true, follow: true },
  };
}

export default async function FormPublicPage({ params }: PageProps) {
  const form = await getPublicFormBySlug(params.slug);
  if (!form) notFound();
  return <FormPublicClient slug={params.slug} initialForm={form} />;
}
