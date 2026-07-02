// Public booking page — no authentication required.
// Server component: fetches calendar for metadata, renders BookingClient.

import type { Metadata } from "next";
import { BookingClient } from "./BookingClient";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.genesy.com.br";
    const res = await fetch(`${baseUrl}/api/agendar/${slug}`, { cache: "no-store" });
    if (!res.ok) return { title: "Agendamento" };

    const { calendar } = await res.json() as {
      calendar?: {
        name: string;
        description: string | null;
        settings?: { page?: { title?: string | null; subtitle?: string | null } };
      };
    };
    if (!calendar) return { title: "Agendamento" };

    const pageTitle = calendar.settings?.page?.title ?? calendar.name;
    const description = calendar.settings?.page?.subtitle ?? calendar.description ?? undefined;

    return {
      title:       pageTitle,
      description,
      openGraph: {
        title:       pageTitle,
        description: description ?? undefined,
        type:        "website",
        url:         `${baseUrl}/agendar/${slug}`,
      },
      twitter: {
        card:        "summary",
        title:       pageTitle,
        description: description ?? undefined,
      },
    };
  } catch {
    return { title: "Agendamento" };
  }
}

export default async function AgendarPage({ params }: Props) {
  const { slug } = await params;
  return <BookingClient slug={slug} />;
}
