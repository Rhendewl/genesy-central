"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Plug, Loader2, RefreshCw } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { IntegrationCard }   from "@/components/integracoes/IntegrationCard";
import { IntegrationDrawer } from "@/components/integracoes/IntegrationDrawer";
import { useFormularioEditor } from "@/hooks/useFormularioEditor";
import { useFormularioIntegracoes } from "@/hooks/useFormularioIntegracoes";
import { INTEGRATION_CATALOG } from "@/lib/integrations/catalog";
import type { IntegrationDefinition } from "@/lib/integrations/catalog";

export default function FormularioIntegracoesPage() {
  const { id } = useParams<{ id: string }>();
  const { form } = useFormularioEditor(id);
  const { integrations, isLoading, error, save, create, remove, reload } = useFormularioIntegracoes(id);

  const [drawerDef,  setDrawerDef]  = useState<IntegrationDefinition | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback((def: IntegrationDefinition) => {
    setDrawerDef(def);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const rowForDef = useMemo(() => (def: IntegrationDefinition) =>
    integrations.find(i => i.adapter === def.adapterName),
    [integrations],
  );

  const handleSave = useCallback(async (configId: string, patch: Parameters<typeof save>[1]) => {
    const ok = await save(configId, patch);
    return ok;
  }, [save]);

  const handleCreate = useCallback(async (adapter: string) => {
    const row = await create(adapter);
    return row;
  }, [create]);

  const handleDelete = useCallback(async (configId: string) => {
    const ok = await remove(configId);
    if (ok) reload();
    return ok;
  }, [remove, reload]);

  return (
    <div className="flex flex-col min-h-screen pb-24" style={{ background: "var(--background)" }}>
      <Header
        title="Integrações"
        subtitle={form?.name ?? ""}
      />

      <div className="px-4 sm:px-6 pt-2 pb-4">

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-2 py-8" style={{ color: "var(--muted-foreground)" }}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Carregando integrações…</span>
          </div>
        )}

        {/* Erro */}
        {error && !isLoading && (
          <div
            className="rounded-xl p-4 mb-6 flex items-center justify-between"
            style={{ background: "#ef444412", border: "1px solid #ef444430" }}
          >
            <p className="text-sm" style={{ color: "#f87171" }}>{error}</p>
            <button onClick={reload} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <RefreshCw size={12} />
              Tentar novamente
            </button>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Descrição */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-5"
            >
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Conecte este formulário a plataformas externas. Cada integração processa eventos
                de forma assíncrona, sem impactar a experiência do usuário.
              </p>
            </motion.div>

            {/* Resumo de conexões */}
            {integrations.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 mb-5"
              >
                <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: "#22c55e15", color: "#22c55e", border: "1px solid #22c55e30" }}>
                  <Plug size={11} />
                  {integrations.filter(i => i.enabled).length} de {integrations.length} ativa{integrations.filter(i => i.enabled).length !== 1 ? "s" : ""}
                </div>
              </motion.div>
            )}

            {/* Grid de integrações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
              {INTEGRATION_CATALOG.map((def, i) => (
                <IntegrationCard
                  key={def.adapterName}
                  definition={def}
                  row={rowForDef(def)}
                  index={i}
                  onClick={() => openDrawer(def)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Drawer de configuração */}
      {drawerDef && (
        <IntegrationDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          definition={drawerDef}
          row={rowForDef(drawerDef)}
          formId={id}
          formSlug={form?.slug ?? id}
          onSave={handleSave}
          onCreate={handleCreate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
