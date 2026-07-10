import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

// Formulários de NPS são sempre nomeados "NPS — {cliente}" na criação
// (ver /api/clientes/[id]/nps-form) — detectar pelo prefixo evita precisar
// ler form_integrations (sem policy de leitura pública) só pra saber o adapter.
const NPS_NAME_PREFIX = "NPS — ";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const anon = createAnonClient();
    const { data: form } = await anon
      .from("forms")
      .select("name")
      .eq("slug", slug)
      .is("deleted_at", null)
      .maybeSingle();

    if (!form?.name) return { title: "Genesy Formulário" };

    const title = form.name.startsWith(NPS_NAME_PREFIX)
      ? `Genesy NPS | ${form.name.slice(NPS_NAME_PREFIX.length)}`
      : `Genesy Formulário | ${form.name}`;

    return { title };
  } catch {
    return { title: "Genesy Formulário" };
  }
}

// Layout público do formulário — sem Dock, sem autenticação, sem Header administrativo.
// Não aplica fundo aqui: page.tsx controla o background via tema do formulário.
export default function FormPublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
