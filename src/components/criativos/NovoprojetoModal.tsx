"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { NewCriativoProjeto, CriativoTom, CriativoEstiloVisual, CriativoSegmento } from "@/types";

const TONS: { value: CriativoTom; label: string; desc: string }[] = [
  { value: "urgente",       label: "Urgente",       desc: "Cria senso de escassez e ação imediata" },
  { value: "sofisticado",   label: "Sofisticado",   desc: "Elegante e premium" },
  { value: "amigavel",      label: "Amigável",      desc: "Próximo, humano e acessível" },
  { value: "profissional",  label: "Profissional",  desc: "Sério, confiável e corporativo" },
  { value: "emocional",     label: "Emocional",     desc: "Conecta com sentimentos e aspirações" },
  { value: "direto",        label: "Direto",        desc: "Objetivo, sem rodeios" },
];

const ESTILOS: { value: CriativoEstiloVisual; label: string; desc: string }[] = [
  { value: "minimalista", label: "Minimalista", desc: "Limpo, espaço em branco, tipografia forte" },
  { value: "bold",        label: "Bold",        desc: "Cores vibrantes, impacto visual alto" },
  { value: "luxury",      label: "Luxury",      desc: "Dourado, dark, textura premium" },
  { value: "moderno",     label: "Moderno",     desc: "Gradientes suaves, contemporâneo" },
  { value: "colorido",    label: "Colorido",    desc: "Paleta rica, alegre e chamativo" },
  { value: "escuro",      label: "Escuro",      desc: "Dark mode, sofisticado e tecnológico" },
];

const SEGMENTOS: { value: CriativoSegmento; label: string }[] = [
  { value: "imobiliario", label: "Imobiliário" },
  { value: "varejo",      label: "Varejo" },
  { value: "servicos",    label: "Serviços" },
  { value: "saude",       label: "Saúde" },
  { value: "educacao",    label: "Educação" },
  { value: "outro",       label: "Outro" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NewCriativoProjeto) => Promise<void>;
  isLoading?: boolean;
}

const STEPS = ["Projeto", "Contexto", "Estilo"];

export function NovoProjetoModal({ open, onClose, onSubmit, isLoading }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<NewCriativoProjeto>>({
    segmento: "imobiliario",
    tom: "profissional",
    estilo_visual: "moderno",
  });

  const set = (key: keyof NewCriativoProjeto, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const canNext = () => {
    if (step === 0) return !!form.nome?.trim();
    if (step === 1) return !!form.objetivo?.trim() && !!form.publico?.trim() && !!form.oferta?.trim();
    return !!form.tom && !!form.estilo_visual;
  };

  const handleSubmit = async () => {
    if (!canNext()) return;
    await onSubmit(form as NewCriativoProjeto);
    setStep(0);
    setForm({ segmento: "imobiliario", tom: "profissional", estilo_visual: "moderno" });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg" style={{ background: "var(--accent)" }}>
              <Sparkles size={16} style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <h2 className="font-semibold text-sm" style={{ color: "var(--text-title)" }}>
                Novo Projeto
              </h2>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Passo {step + 1} de {STEPS.length} — {STEPS[step]}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <X size={16} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: i <= step ? "var(--primary)" : "var(--border)" }}
            />
          ))}
        </div>

        {/* Step 0 — Nome e Segmento */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
                Nome do Projeto *
              </Label>
              <Input
                placeholder="Ex: Lançamento Residencial Jardins"
                value={form.nome ?? ""}
                onChange={e => set("nome", e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
                Segmento
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {SEGMENTOS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => set("segmento", s.value)}
                    className="px-3 py-2 rounded-lg border text-xs font-medium transition-all"
                    style={{
                      borderColor: form.segmento === s.value ? "var(--primary)" : "var(--border)",
                      background: form.segmento === s.value ? "var(--accent)" : "transparent",
                      color: form.segmento === s.value ? "var(--primary)" : "var(--muted-foreground)",
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1 — Contexto */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
                Objetivo da Campanha *
              </Label>
              <Input
                placeholder="Ex: Gerar leads qualificados para apartamentos de alto padrão"
                value={form.objetivo ?? ""}
                onChange={e => set("objetivo", e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
                Público-Alvo *
              </Label>
              <Input
                placeholder="Ex: Investidores 35-55 anos, classe A/B, São Paulo"
                value={form.publico ?? ""}
                onChange={e => set("publico", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
                Oferta / Produto *
              </Label>
              <Textarea
                placeholder="Ex: Apartamentos de 2 e 3 quartos, 80-120m², varanda gourmet, piscina, a partir de R$ 850k"
                value={form.oferta ?? ""}
                onChange={e => set("oferta", e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        )}

        {/* Step 2 — Estilo */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
                Tom de Comunicação
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {TONS.map(t => (
                  <button
                    key={t.value}
                    onClick={() => set("tom", t.value)}
                    className="px-3 py-2.5 rounded-lg border text-left transition-all"
                    style={{
                      borderColor: form.tom === t.value ? "var(--primary)" : "var(--border)",
                      background: form.tom === t.value ? "var(--accent)" : "transparent",
                    }}
                  >
                    <p className="text-xs font-medium" style={{ color: form.tom === t.value ? "var(--primary)" : "var(--text-title)" }}>
                      {t.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {t.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium" style={{ color: "var(--text-title)" }}>
                Estilo Visual
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {ESTILOS.map(e => (
                  <button
                    key={e.value}
                    onClick={() => set("estilo_visual", e.value)}
                    className="px-3 py-2.5 rounded-lg border text-left transition-all"
                    style={{
                      borderColor: form.estilo_visual === e.value ? "var(--primary)" : "var(--border)",
                      background: form.estilo_visual === e.value ? "var(--accent)" : "transparent",
                    }}
                  >
                    <p className="text-xs font-medium" style={{ color: form.estilo_visual === e.value ? "var(--primary)" : "var(--text-title)" }}>
                      {e.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {e.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-6 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => step === 0 ? onClose() : setStep(s => s - 1)}
            className="gap-1.5"
          >
            {step > 0 && <ChevronLeft size={14} />}
            {step === 0 ? "Cancelar" : "Voltar"}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button
              size="sm"
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext()}
              className="gap-1.5"
            >
              Próximo
              <ChevronRight size={14} />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!canNext() || isLoading}
              className="gap-1.5"
            >
              {isLoading ? "Criando..." : "Criar Projeto"}
              {!isLoading && <Sparkles size={14} />}
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
