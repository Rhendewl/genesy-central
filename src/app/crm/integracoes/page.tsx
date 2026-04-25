import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CrmIntegracoes } from "@/components/crm/CrmIntegracoes";

export default function CrmIntegracoesPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#4a8fd4]" />
          </div>
        }
      >
        <CrmIntegracoes />
      </Suspense>
    </div>
  );
}
