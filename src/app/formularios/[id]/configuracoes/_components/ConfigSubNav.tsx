"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { Settings, Users } from "lucide-react";

const SUB_TABS = [
  { label: "Configurações Gerais", suffix: "",     icon: Settings },
  { label: "Integração CRM",       suffix: "/crm", icon: Users    },
] as const;

export function ConfigSubNav() {
  const { id }   = useParams<{ id: string }>();
  const pathname = usePathname();
  const router   = useRouter();

  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {SUB_TABS.map(tab => {
        const href   = `/formularios/${id}/configuracoes${tab.suffix}`;
        const active = pathname === href;
        const Icon   = tab.icon;
        return (
          <button
            key={tab.suffix}
            onClick={() => router.push(href)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
            style={{
              background: active ? "rgba(255,255,255,0.10)" : "transparent",
              color:      active ? "var(--text-title)" : "var(--muted-foreground)",
              border:     `1px solid ${active ? "var(--border)" : "transparent"}`,
            }}
          >
            <Icon size={12} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
