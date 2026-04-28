"use client";

import { Header } from "@/components/layout/Header";
import { PortaisList } from "@/components/portais/PortaisList";

export default function PortaisPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <Header
        title="Portais"
        subtitle="Dashboards públicos para clientes acompanharem campanhas"
      />
      <div className="pb-8">
        <PortaisList />
      </div>
    </div>
  );
}
