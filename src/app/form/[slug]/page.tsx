import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicFormBySlug } from "@/lib/forms/public-form";
import { FormPublicClient } from "./FormPublicClient";

export const revalidate = 60;
export const dynamic = "force-static";
export const dynamicParams = true;

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
