import { ModuleAccessGate } from "@/components/layout/ModuleAccessGate";
import { MarketingSubNav } from "@/components/marketing/MarketingSubNav";
import { MarketingProvider } from "@/context/MarketingContext";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleAccessGate module="marketing">
      <div
        className="marketing-shell module-shell-bg m-0 min-h-[100dvh] overflow-hidden border-y sm:m-3 sm:min-h-[calc(100dvh-24px)] sm:rounded-[20px] sm:border"
        style={{
          background: "rgba(10,10,10,.10)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          borderColor: "var(--glass-border)",
          boxShadow: "0 12px 40px rgba(0,0,0,.18)",
        }}
      >
        <MarketingProvider>
          <MarketingSubNav />
          {children}
        </MarketingProvider>
      </div>
    </ModuleAccessGate>
  );
}
