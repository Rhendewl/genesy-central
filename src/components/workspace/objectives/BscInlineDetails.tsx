"use client";
import { useState } from "react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase";
import type { WorkspaceObjective } from "@/types/workspace-objectives";
import type { BscMetric } from "@/lib/workspace/bsc";
import { AssigneePicker } from "@/components/workspace/AssigneePicker";
import { TagSelector } from "@/components/tags/TagSelector";
import styles from "./bsc.module.css";
export function BscInlineDetails({
  objective,
  metrics,
  onSaved,
  onAdvanced,
}: {
  objective: WorkspaceObjective;
  metrics: BscMetric[];
  onSaved: () => void;
  onAdvanced: () => void;
}) {
  const [draft, setDraft] = useState(() => ({
    title: objective.title,
    description: objective.description ?? "",
    priority: objective.priority,
    horizon: objective.horizon,
    status: objective.status,
    start_date: objective.start_date ?? "",
    due_date: objective.due_date ?? "",
    assignee_ids: objective.assignee_ids ?? [],
    tags: objective.tags,
  }));
  const [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState(false),
    [dirty, setDirty] = useState(false);
  function update(values: Partial<typeof draft>) {
    setDraft((d) => ({ ...d, ...values }));
    setDirty(true);
  }
  async function save() {
    setBusy(true);
    try {
      const r = await fetch(`/api/workspace/objectives/${objective.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          start_date: draft.start_date || null,
          due_date: draft.due_date || null,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setDirty(false);
      toast.success("Objetivo atualizado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`${styles.editor} space-y-5`}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="space-y-3"
      >
        <label>
          Objetivo
          <input
            aria-label="Nome do objetivo"
            required
            maxLength={500}
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
            className="text-2xl"
          />
        </label>
        <label>
          Descrição
          <textarea
            aria-label="Descrição do objetivo"
            rows={2}
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            placeholder="Descreva o resultado esperado"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Prioridade
            <select
              value={draft.priority}
              onChange={(e) =>
                update({ priority: e.target.value as typeof draft.priority })
              }
            >
              {[
                ["baixa", "Baixa"],
                ["media", "Média"],
                ["alta", "Alta"],
                ["urgente", "Urgente"],
              ].map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Horizonte
            <select
              value={draft.horizon}
              onChange={(e) =>
                update({ horizon: e.target.value as typeof draft.horizon })
              }
            >
              {[
                ["curto", "Curto prazo"],
                ["medio", "Médio prazo"],
                ["longo", "Longo prazo"],
              ].map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={draft.status}
              onChange={(e) =>
                update({ status: e.target.value as typeof draft.status })
              }
            >
              {[
                ["planejado", "Planejado"],
                ["em_andamento", "Em andamento"],
                ["pausado", "Pausado"],
                ["concluido", "Concluído"],
                ["cancelado", "Cancelado"],
              ].map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            Data de início
            <input
              type="date"
              value={draft.start_date}
              onChange={(e) => update({ start_date: e.target.value })}
            />
          </label>
          <label>
            Data de término
            <input
              type="date"
              min={draft.start_date || undefined}
              value={draft.due_date}
              onChange={(e) => update({ due_date: e.target.value })}
            />
          </label>
        </div>
        <div className="space-y-2">
          <span className="text-xs text-[var(--muted-foreground)]">
            Responsáveis
          </span>
          <AssigneePicker
            value={draft.assignee_ids}
            onChange={(assignee_ids) => update({ assignee_ids })}
          />
        </div>
        <TagSelector
          scope="workspace"
          value={draft.tags}
          onChange={(tags) => update({ tags })}
        />
        {dirty && (
          <button disabled={busy} className="lc-btn px-4 py-2 text-xs">
            {busy ? "Salvando…" : "Salvar informações"}
          </button>
        )}
      </form>
      <div className="border-t border-[var(--border)] pt-4">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide">
          Indicadores e metas
        </h4>
        {metrics.map((m) => (
          <InlineMetric
            key={`${m.id}:${m.title}:${m.unit}:${m.baseline}:${m.target}:${m.current_value}`}
            metric={m}
            onSaved={onSaved}
          />
        ))}
        {!metrics.length && (
          <button className="text-sm underline" onClick={onAdvanced}>
            Adicionar indicador
          </button>
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-3 border-t border-[var(--border)] pt-3 text-xs">
        <button onClick={onAdvanced}>Blocos, subobjetivos e anexos</button>
        <button onClick={() => setDeleting(true)} className="text-red-500">
          Excluir objetivo desta área
        </button>
      </div>
      {deleting && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 p-3 text-xs"
        >
          <p>
            Excluir este objetivo e seus indicadores nesta área? As outras áreas
            e as tarefas do Workspace serão mantidas. Tarefas concluídas sem
            outros vínculos voltam à limpeza automática. Esta exclusão não pode
            ser desfeita.
          </p>
          <div className="mt-3 flex gap-4">
            <button disabled={busy} onClick={() => setDeleting(false)}>
              Cancelar
            </button>
            <button
              className="text-red-500"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await fetch(
                    `/api/workspace/objectives/${objective.id}`,
                    { method: "DELETE" },
                  );
                  const result = await r.json();
                  if (!r.ok) throw new Error(result.error);
                  toast.success("Objetivo excluído");
                  onSaved();
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Erro ao excluir",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirmar exclusão
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
function InlineMetric({
  metric,
  onSaved,
}: {
  metric: BscMetric;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({
    title: metric.title,
    unit: metric.unit,
    baseline: String(metric.baseline),
    target: String(metric.target),
    current_value: String(metric.current_value),
  });
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="mb-4 space-y-2 rounded-xl border border-[var(--border)] p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const numbers = {
          baseline: Number(draft.baseline),
          target: Number(draft.target),
          current_value: Number(draft.current_value),
        };
        if (
          !Object.values(numbers).every(Number.isFinite) ||
          numbers.baseline === numbers.target
        ) {
          toast.error(
            "Use valores válidos e uma meta diferente do valor inicial",
          );
          return;
        }
        setBusy(true);
        try {
          const r = await getSupabaseClient()
            .from("workspace_objective_metrics")
            .update({ ...draft, ...numbers })
            .eq("id", metric.id)
            .select("id")
            .single();
          if (r.error) throw new Error(r.error.message);
          setDirty(false);
          onSaved();
          window.dispatchEvent(new Event("workspace-bsc-metrics-changed"));
          toast.success("Meta e realizado atualizados");
        } catch (e) {
          toast.error(
            e instanceof Error ? e.message : "Erro ao salvar indicador",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      {(
        [
          ["title", "Indicador"],
          ["unit", "Unidade"],
          ["target", "Meta"],
          ["baseline", "Valor inicial"],
          ["current_value", "Realizado"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex items-center gap-3">
          <span className="w-24 shrink-0">{label}</span>
          <input
            aria-label={`${label} de ${metric.title}`}
            required={key !== "unit"}
            type={key === "title" || key === "unit" ? "text" : "number"}
            step="any"
            maxLength={key === "title" ? 200 : 50}
            value={draft[key]}
            onChange={(e) => {
              setDraft({ ...draft, [key]: e.target.value });
              setDirty(true);
            }}
          />
        </label>
      ))}
      {dirty && (
        <button disabled={busy} className="lc-btn px-3 py-2 text-xs">
          {busy ? "Salvando…" : "Salvar indicador"}
        </button>
      )}
    </form>
  );
}
