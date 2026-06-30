"use client";

import { useParams, useRouter } from "next/navigation";
import {
  Pencil, FileText, Clock, Calendar, CheckSquare,
  Loader2, Link2, ExternalLink,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { FormularioShell } from "./_components/FormularioShell";
import { useFormularioEditor } from "@/hooks/useFormularioEditor";
import { FormRenderer } from "@/components/formularios/FormRenderer";
import type { FormRendererScreen } from "@/components/formularios/FormRenderer";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function isHtml(s?: string) {
  return !!s && s.trimStart().startsWith("<");
}

function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, "").trim();
}

// ── Cartão de info ─────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: "var(--accent)" }}
        aria-hidden="true"
      >
        <Icon size={13} style={{ color: "var(--primary)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--muted-foreground)" }}>
          {label}
        </p>
        <p className="text-xs font-medium truncate" style={{ color: "var(--text-title)" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Seção futura (placeholder) ─────────────────────────────────────────────────

function FutureMetric({ label }: { label: string }) {
  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-lg"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)" }}
    >
      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.20)" }}>{label}</span>
      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.10)" }}>em breve</span>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────────

export default function FormularioOverviewPage() {
  const { id }  = useParams<{ id: string }>();
  const router  = useRouter();
  const { form, isLoading } = useFormularioEditor(id);

  // Dados derivados
  const steps      = form?.steps ?? [];
  const hasWelcome = form?.welcome_screen?.enabled ?? false;
  const theme = {
    ...(form?.theme ?? {}),
    backgroundColor: form?.theme?.backgroundColor && !form.theme.backgroundColor.startsWith("var(")
      ? form.theme.backgroundColor
      : "#ffffff",
    primaryColor: form?.theme?.primaryColor && !form.theme.primaryColor.startsWith("var(")
      ? form.theme.primaryColor
      : "#22c55e",
  };

  const isPublished = form?.status === "published" && !!form.slug;
  const publicPath  = form?.slug ? `/form/${form.slug}` : null;

  const welcomeTitle = form?.welcome_screen?.title
    ? (isHtml(form.welcome_screen.title)
        ? stripHtml(form.welcome_screen.title)
        : form.welcome_screen.title)
    : null;

  // ── Ações ──────────────────────────────────────────────────────────────────

  const copyLink = () => {
    if (!publicPath) return;
    const fullUrl = `${window.location.origin}${publicPath}`;
    navigator.clipboard.writeText(fullUrl).then(() => toast.success("Link copiado"));
  };

  const openForm = () => {
    if (!publicPath) return;
    window.open(publicPath, "_blank", "noopener,noreferrer");
  };

  // ── Renderer compartilhado ─────────────────────────────────────────────────

  const previewScreen: FormRendererScreen = hasWelcome ? "welcome" : steps.length > 0 ? "step" : "ending";

  const sharedRendererProps = {
    form: { ...form!, theme },
    screen: previewScreen,
    currentStepIndex: 0,
    direction: 1,
    answers: {},
    isSubmitting: false,
    canGoBack: false,
    onStart:   () => {},
    onNext:    () => {},
    onBack:    () => {},
    onRestart: () => {},
    onAnswer:  () => {},
    mode: "preview" as const,
  };

  return (
    <FormularioShell id={id}>
      <div className="px-4 sm:px-6 py-6">

        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex items-center gap-2 py-12" style={{ color: "var(--muted-foreground)" }}>
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Carregando…</span>
          </div>
        )}

        {!isLoading && form && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-6"
          >

            {/* ── Barra de ações ── */}
            <div className="flex items-center justify-end gap-2">

              <div className="flex items-center gap-2">

              {/* Botões visíveis apenas quando publicado */}
              {isPublished && (
                <>
                  {/* Copiar link */}
                  <button
                    onClick={copyLink}
                    title="Copiar link público"
                    aria-label="Copiar link público do formulário"
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10 active:scale-95"
                    style={{
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    <Link2 size={14} aria-hidden="true" />
                  </button>

                  {/* Abrir em nova guia */}
                  <button
                    onClick={openForm}
                    title="Abrir formulário em nova guia"
                    aria-label="Abrir formulário publicado em nova guia"
                    className="w-8 h-8 flex items-center justify-center rounded-lg transition-all hover:bg-white/10 active:scale-95"
                    style={{
                      border: "1px solid rgba(255,255,255,0.10)",
                      color: "var(--muted-foreground)",
                    }}
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                  </button>

                  {/* Separador */}
                  <div
                    className="flex-shrink-0"
                    style={{ width: 1, height: 20, background: "rgba(255,255,255,0.09)" }}
                    aria-hidden="true"
                  />
                </>
              )}

              {/* Editor Visual — CTA principal */}
              <button
                onClick={() => router.push(`/formularios/${id}/editor`)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ background: "var(--primary)", color: "#fff" }}
                aria-label="Abrir o Editor Visual deste formulário"
              >
                <Pencil size={14} aria-hidden="true" />
                Editor Visual
              </button>

              </div>{/* fim botões direita */}
            </div>{/* fim barra de ações */}

            {/* ── Layout de duas colunas ── */}
            <div className="flex flex-col lg:flex-row gap-6">

              {/* ── Coluna esquerda: Preview Desktop ── */}
              <div className="flex-1 flex flex-col items-center">
                <div
                  className="w-full overflow-hidden"
                  style={{
                    height: 480,
                    maxWidth: 680,
                    borderRadius: 12,
                    background: theme.backgroundColor,
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 4px 32px rgba(0,0,0,0.35)",
                    pointerEvents: "none",
                  }}
                  aria-label="Preview do formulário"
                  aria-hidden="true"
                >
                  <FormRenderer {...sharedRendererProps} />
                </div>
              </div>

              {/* ── Coluna direita: Informações ── */}
              <div className="lg:w-72 flex flex-col gap-4">

                {/* Card: Informações básicas */}
                <div className="lc-card-base p-4 flex flex-col gap-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                    Informações
                  </p>

                  <InfoRow
                    icon={FileText}
                    label="Perguntas"
                    value={`${steps.length} pergunta${steps.length !== 1 ? "s" : ""}`}
                  />

                  {hasWelcome && welcomeTitle && (
                    <InfoRow
                      icon={CheckSquare}
                      label="Boas-vindas"
                      value={welcomeTitle}
                    />
                  )}

                  <InfoRow
                    icon={Calendar}
                    label="Criado em"
                    value={formatDate(form.created_at)}
                  />

                  <InfoRow
                    icon={Clock}
                    label="Atualizado"
                    value={formatDate(form.updated_at)}
                  />
                </div>

                {/* Card: Métricas */}
                <div className="lc-card-base p-4 flex flex-col gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                    Métricas
                  </p>
                  <FutureMetric label="Total de respostas" />
                  <FutureMetric label="Taxa de conclusão" />
                  <FutureMetric label="Tempo médio" />
                </div>

                {/* Card: Integrações */}
                <div className="lc-card-base p-4 flex flex-col gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
                    Integrações
                  </p>
                  <FutureMetric label="CRM" />
                  <FutureMetric label="Webhook" />
                </div>

              </div>
            </div>

          </motion.div>
        )}
      </div>
    </FormularioShell>
  );
}
