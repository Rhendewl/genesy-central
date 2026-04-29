import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const anon = createAnonClient();
    const { data: portal } = await anon
      .from("portals")
      .select("client_id")
      .eq("slug", slug)
      .maybeSingle();

    if (!portal) return { title: "Genesy | Portal Cliente" };

    let clientName: string | null = null;
    if (portal.client_id) {
      const { data: client } = await anon
        .from("agency_clients")
        .select("name")
        .eq("id", portal.client_id)
        .maybeSingle();
      clientName = client?.name ?? null;
    }

    return {
      title: clientName ? `Genesy | ${clientName}` : "Genesy | Portal Cliente",
    };
  } catch {
    return { title: "Genesy | Portal Cliente" };
  }
}

export default function PortalSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
