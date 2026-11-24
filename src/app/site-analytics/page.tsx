"use client";
import { Header } from "@/components/layout/Header";
import { SiteAnalyticsDashboard } from "@/components/site-analytics/SiteAnalyticsDashboard";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import { AlertTriangle } from "lucide-react";

export default function SiteAnalyticsPage() {
  const { member, isOwner, isLoading } = useCurrentMember();
  const allowed = isOwner === true || member?.role === "admin";
  return <div className="dashboard-geral-bg"><div className="mx-auto max-w-7xl space-y-5 px-4 pb-28 sm:px-6"><Header title="Site Genesy" subtitle="Acessos, leads, Pixel e CRM do site e de cada landing page" />{isLoading ? <div className="lc-card h-72 animate-pulse"/> : allowed ? <SiteAnalyticsDashboard/> : <div className="lc-card p-8 text-center"><AlertTriangle className="mx-auto mb-3 text-amber-400"/><h2 className="font-bold">Acesso restrito</h2><p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>Este módulo é administrado por proprietários e administradores.</p></div>}</div></div>;
}
