import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { MetaLeadsManager } from "@/components/crm/MetaLeadsManager";

export default function MetaLeadsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Suspense
        fallback={
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-[#4a8fd4]" />
          </div>
        }
      >
        <MetaLeadsManager />
      </Suspense>
    </div>
  );
}
