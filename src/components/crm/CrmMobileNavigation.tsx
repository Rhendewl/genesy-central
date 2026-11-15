"use client";
import type { ReactNode } from "react";
import { FinancialPrivacyButton } from "@/components/ui/FinancialPrivacyButton";

/** Horizontal section buttons, as in the original mobile navigation. */
export function CrmMobileNavigation({ tabs, value, onChange }: {
  tabs: { id: string; label: string; icon?: ReactNode }[]; value: string; onChange: (value: string) => void;
}) {
  return <nav aria-label="Navegação do CRM" className="crm-mobile-navigation md:hidden">
    <h1 className="sr-only">CRM</h1>
    <div className="crm-mobile-tabs scrollbar-none">
      {tabs.map(tab=><button type="button" key={tab.id} onClick={()=>onChange(tab.id)} aria-current={value===tab.id?"page":undefined}
        className={`crm-mobile-tab ${value===tab.id?"is-active":""}`}>
        {tab.icon}<span>{tab.label}</span>
      </button>)}
    </div>
    <FinancialPrivacyButton compact className="crm-mobile-privacy"/>
  </nav>;
}
