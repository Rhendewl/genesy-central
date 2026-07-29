import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicFormBySlug } from "@/lib/forms/public-form";
import { FormPublicClient } from "./FormPublicClient";

// A visitor may try this URL before the owner publishes the form. Rendering it
// dynamically prevents that first 404 from being cached after publication.
export const revalidate = 0;
export const dynamic = "force-dynamic";

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
