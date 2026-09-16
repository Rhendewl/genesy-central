import { redirect } from "next/navigation";

export default function LegacyMarketingVgvPage() {
  redirect("/clientes?tab=vgv");
}
