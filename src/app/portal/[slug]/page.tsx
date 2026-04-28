import { PortalPublicDashboard } from "@/components/portais/PortalPublicDashboard";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PortalPublicDashboard slug={slug} />;
}

export const dynamic = "force-dynamic";
