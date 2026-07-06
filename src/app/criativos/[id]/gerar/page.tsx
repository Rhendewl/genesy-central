"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, CheckCircle2, AlertCircle, ArrowLeft, Zap } from "lucide-react";
import { useCriativoJob } from "@/hooks/useCriativoJob";
import type { CriativoResultado } from "@/types";

function CriativoMiniCard({ resultado }: { readonly resultado: CriativoResultado }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="rounded-xl overflow-hidden border"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      {resultado.imagem_url ? (
        <img
          src={resultado.imagem_url}
          alt={resultado.headline ?? "Criativo gerado"}
          className="w-full aspect-square object-cover"
        />
      ) : (
        <div
          className="w-full aspect-square flex items-center justify-center"
          style={{ background: "var(--accent)" }}
        >
          <Sparkles size={24} style={{ color: "var(--primary)" }} />
        </div>
      )}
      <div className="p-3">
        <p className="text-xs font-semibold truncate mb-0.5" style={{ color: "var(--text-title)" }}>
          {resultado.headline ?? "Gerando..."}
        </p>
        <p className="text-xs line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
          {resultado.copy ?? ""}
        </p>
        {resultado.cta && (
          <span
            className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: "var(--accent)", color: "var(--primary)" }}
          >
            {resultado.cta}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default function GerarPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");

  const { job, resultados } = useCriativoJob(jobId);
  const [autoRedirected, setAutoRedirected] = useState(false);

  // Redireciona automaticamente para a galeria quando o job conclui
  useEffect(() => {
    if (!autoRedirected && job?.status === "concluido") {
      setAutoRedirected(true);
      setTimeout(() => router.push(`/criativos/${params.id}`), 1800);
    }
  }, [job?.status, autoRedirected, router, params.id]);

  const progresso = job?.progresso ?? 0;
  const status = job?.status ?? "pendente";
  const concluido = status === "concluido";
  const erro = status === "erro";

  const etapaLabel = () => {
    if (erro) return "Erro na geração";
    if (concluido) return "Criativos prontos!";
    if (progresso === 0) return "Iniciando pipeline...";
    if (progresso < 30) return "Gerando copies com Claude...";
    if (progresso < 70) return "Criando imagens com DALL-E 3...";
    if (progresso < 100) return "Finalizando criativos...";
    return "Concluindo...";
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start px-4 pt-10 pb-24"
      style={{ background: "var(--background)" }}
    >
      {/* Header */}
      <div className="w-full max-w-2xl mb-8">
        <button
          onClick={() => router.push(`/criativos/${params.id}`)}
          className="flex items-center gap-2 text-sm mb-6 hover:opacity-70 transition-opacity"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft size={14} />
          Voltar ao projeto
        </button>

        <div className="text-center">
          <motion.div
            animate={concluido ? {} : { rotate: 360 }}
            transition={{ repeat: concluido ? 0 : Infinity, duration: 2, ease: "linear" }}
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: concluido ? "#22c55e20" : erro ? "#ef444420" : "var(--accent)" }}
          >
            {concluido ? (
              <CheckCircle2 size={28} color="#22c55e" />
            ) : erro ? (
              <AlertCircle size={28} color="#ef4444" />
            ) : (
              <Zap size={28} style={{ color: "var(--primary)" }} />
            )}
          </motion.div>

          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-title)" }}>
            {concluido ? "Criativos gerados!" : erro ? "Algo deu errado" : "Gerando criativos..."}
          </h1>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {erro ? (job?.erro_mensagem ?? "Erro desconhecido") : etapaLabel()}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {!erro && (
        <div className="w-full max-w-2xl mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>Progresso</span>
            <span className="text-xs font-medium" style={{ color: "var(--text-title)" }}>{progresso}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: concluido ? "#22c55e" : "var(--primary)" }}
              initial={{ width: "0%" }}
              animate={{ width: `${progresso}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              {resultados.length} de {job?.quantidade ?? "?"} criativos
            </span>
            {job?.tokens_usados ? (
              <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {job.tokens_usados.toLocaleString()} tokens usados
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* Grid de criativos chegando em tempo real */}
      {resultados.length > 0 && (
        <div className="w-full max-w-2xl">
          <p className="text-xs font-medium mb-3" style={{ color: "var(--muted-foreground)" }}>
            CHEGANDO EM TEMPO REAL
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <AnimatePresence>
              {resultados.map(r => (
                <CriativoMiniCard key={r.id} resultado={r} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Redirect notice */}
      {concluido && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          Redirecionando para a galeria...
        </motion.p>
      )}

      {/* Erro — botão de voltar */}
      {erro && (
        <button
          onClick={() => router.push(`/criativos/${params.id}`)}
          className="mt-6 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90"
          style={{ background: "#b0b8c1", color: "#000000" }}
        >
          Voltar ao projeto
        </button>
      )}
    </div>
  );
}
