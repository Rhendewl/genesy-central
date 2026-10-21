"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, X, Check } from "lucide-react";
import { useModalOpen } from "@/hooks/useModalOpen";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { AssigneePicker } from "@/components/workspace/AssigneePicker";
import { TagSelector } from "@/components/tags/TagSelector";
import { BSC_COLORS } from "@/lib/workspace/bsc";
import {
  newBscDraft,
  validateBscDraft,
  type BscAreaDraft,
} from "@/lib/workspace/bsc-draft";

const areaSteps = [
  "intro",
  "description",
  "indicator",
  "unit",
  "baseline",
  "target",
  "current_value",
  "assignee_ids",
  "tasks",
  "task_ids",
] as const;
const finalSteps = [
  "horizon",
  "priority",
  "start_date",
  "due_date",
  "tags",
  "review",
] as const;
const steps = [
  { key: "title", area: -1 },
  ...Array.from({ length: 4 }, (_, area) =>
    areaSteps.map((key) => ({ key, area })),
  ).flat(),
  ...finalSteps.map((key) => ({ key, area: -1 })),
];
const field =
  "w-full rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 text-lg outline-none focus:border-amber-400";
export function BscWizard({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  useModalOpen(true);
  const { viewingMember } = useWorkspaceViewing();
  const tasks = useWorkspaceTasks(viewingMember?.auth_user_id ?? undefined);
  const [draft, setDraft] = useState(newBscDraft);
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const current = steps[step],
    area = current.area >= 0 ? draft.areas[current.area] : null;
  const color = area ? BSC_COLORS[area.perspective] : null;
  useEffect(() => {
    input.current?.focus();
  }, [step]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  function close() {
    if (busy) return;
    if (draft.title.trim()) setConfirmClose(true);
    else onClose();
  }
  function updateArea(values: Partial<BscAreaDraft>) {
    setDraft((d) => ({
      ...d,
      areas: d.areas.map((a, i) =>
        i === current.area ? { ...a, ...values } : a,
      ),
    }));
  }
  const questions: Record<string, string> = {
    title: "Qual é o nome do objetivo?",
    description: "O que você quer alcançar nesta área?",
    indicator: "Qual indicador vai medir esse resultado?",
    unit: "Em qual unidade vamos medir?",
    baseline: "Qual é o valor inicial?",
    target: "Qual é a meta acumulada?",
    current_value: "Quanto já foi realizado?",
    assignee_ids: "Quem será responsável por esta área?",
    tasks: "Quais tarefas precisam ser feitas?",
    task_ids: "Quer vincular tarefas que já existem?",
    horizon: "Qual é o horizonte deste objetivo?",
    priority: "Qual é a prioridade?",
    start_date: "Quando o objetivo começa?",
    due_date: "Qual é a data de término?",
    tags: "Quais etiquetas organizam este objetivo?",
    review: "Tudo pronto para cadastrar?",
  };
  function next() {
    const el = panel.current?.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >("input[data-answer],textarea[data-answer]");
    if (el && !el.reportValidity()) return;
    if (
      current.key === "target" &&
      area &&
      Number(area.target) === Number(area.baseline)
    ) {
      setError("A meta deve ser diferente do valor inicial.");
      return;
    }
    if (
      current.key === "due_date" &&
      draft.start_date &&
      draft.due_date &&
      draft.start_date > draft.due_date
    ) {
      setError("O término deve ser posterior ao início.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(steps.length - 1, s + 1));
  }
  async function submit() {
    const invalid = validateBscDraft(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/workspace/objectives/bsc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: requestId.current,
          user_id: viewingMember?.auth_user_id,
          draft,
        }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || "Não foi possível salvar");
      onCreated();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erro ao salvar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  }
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-3 backdrop-blur-md">
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bsc-question"
        className="lc-modal-panel relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--border-modal)] bg-[var(--bg-modal)] shadow-2xl outline-none"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
          if (e.key === "Tab") {
            const nodes = panel.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input,textarea,select,[tabindex="0"]',
            );
            if (nodes?.length) {
              const first = nodes[0],
                last = nodes[nodes.length - 1];
              if (
                e.shiftKey &&
                (document.activeElement === first ||
                  document.activeElement === panel.current)
              ) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }}
      >
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-amber-400 transition-[width]"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
        <header className="flex items-center justify-between px-6 py-4">
          <span className="text-xs text-[var(--muted-foreground)]">
            Novo objetivo · {step + 1} de {steps.length}
          </span>
          <button
            disabled={busy}
            onClick={close}
            aria-label="Fechar cadastro"
            className="rounded-full p-2 hover:bg-white/5"
          >
            <X size={18} />
          </button>
        </header>
        {confirmClose && (
          <div
            role="alert"
            className="mx-6 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm"
          >
            <p>Sair do cadastro? As respostas ainda não foram salvas.</p>
            <div className="mt-3 flex gap-4">
              <button
                onClick={() => setConfirmClose(false)}
                className="font-medium"
              >
                Continuar preenchendo
              </button>
              <button
                onClick={onClose}
                className="text-[var(--muted-foreground)]"
              >
                Sair sem salvar
              </button>
            </div>
          </div>
        )}
        <div className="min-h-64 overflow-y-auto px-6 pb-8 pt-4 sm:px-10">
          <div className="mb-6 flex items-center gap-2">
            {Object.entries(BSC_COLORS).map(([key, c], i) => (
              <span
                key={key}
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs ${current.area === i ? "ring-2 ring-white/30" : ""}`}
                style={{ background: c.bg, borderColor: c.border }}
              >
                {c.letter}
              </span>
            ))}
            <span className="ml-2 text-xs text-[var(--muted-foreground)]">
              {color?.name ??
                (step === 0 ? "Seu objetivo" : "Configurações gerais")}
            </span>
          </div>
          <h2
            id="bsc-question"
            className="mb-4 text-2xl font-medium text-[var(--text-title)]"
          >
            {current.key === "intro"
              ? `Vamos falar de ${color?.name.toLowerCase()}.`
              : questions[current.key]}
          </h2>
          {current.key === "intro" && (
            <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
              Como “{draft.title}” se traduz nesta área? Vamos definir o
              resultado esperado, o indicador e as tarefas para chegar lá.
            </p>
          )}
          {current.key === "title" && (
            <input
              ref={input}
              data-answer
              required
              maxLength={500}
              aria-label="Nome do objetivo"
              className={field}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Ex.: Aumentar o faturamento"
              onKeyDown={(e) => {
                if (e.key === "Enter") next();
              }}
            />
          )}
          {area && current.key === "description" && (
            <textarea
              data-answer
              aria-label="Resultado esperado"
              className={`${field} min-h-32 text-base`}
              maxLength={10000}
              value={area.description}
              onChange={(e) => updateArea({ description: e.target.value })}
              placeholder="Descreva o resultado esperado nesta área (opcional)"
            />
          )}
          {area &&
            [
              "indicator",
              "unit",
              "baseline",
              "target",
              "current_value",
            ].includes(current.key) && (
              <>
                <input
                  ref={input}
                  data-answer
                  required
                  aria-label={questions[current.key]}
                  type={
                    ["baseline", "target", "current_value"].includes(
                      current.key,
                    )
                      ? "number"
                      : "text"
                  }
                  step="any"
                  maxLength={current.key === "unit" ? 50 : 200}
                  className={field}
                  value={area[current.key as "indicator"]}
                  onChange={(e) =>
                    updateArea({ [current.key]: e.target.value })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") next();
                  }}
                  placeholder={
                    current.key === "indicator"
                      ? "Ex.: Faturamento mensal recorrente"
                      : current.key === "unit"
                        ? "Ex.: R$, clientes, %, dias"
                        : "0"
                  }
                />
                <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                  {current.key === "target"
                    ? "O mês filtra os objetivos. Esta meta não reinicia a cada mês."
                    : current.key === "indicator"
                      ? "Você pode acrescentar outros indicadores nos detalhes após cadastrar."
                      : current.key === "unit"
                        ? "Informe a unidade usada para o valor inicial, a meta e o realizado."
                        : ""}
                </p>
              </>
            )}
          {area && current.key === "assignee_ids" && (
            <>
              <AssigneePicker
                value={area.assignee_ids}
                onChange={(assignee_ids) => updateArea({ assignee_ids })}
              />
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                Os responsáveis também serão atribuídos às novas tarefas desta
                área. Você poderá editar cada tarefa depois.
              </p>
            </>
          )}
          {area && current.key === "tasks" && (
            <>
              <textarea
                data-answer
                aria-label="Novas tarefas"
                className={`${field} min-h-40 text-base`}
                maxLength={20000}
                value={area.tasks}
                onChange={(e) => updateArea({ tasks: e.target.value })}
                placeholder="Uma tarefa por linha (opcional)"
              />
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                Até 30 tarefas. Elas serão criadas no Workspace e vinculadas a
                esta área.
              </p>
            </>
          )}
          {area && current.key === "task_ids" && (
            <div className="space-y-2">
              {tasks.error && (
                <p role="alert" className="text-sm text-red-400">
                  {tasks.error}
                </p>
              )}
              {tasks.isLoading && !tasks.error && (
                <p className="text-sm">Carregando tarefas…</p>
              )}
              {tasks.tasks.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={area.task_ids.includes(t.id)}
                    onChange={(e) =>
                      updateArea({
                        task_ids: e.target.checked
                          ? [...area.task_ids, t.id]
                          : area.task_ids.filter((id) => id !== t.id),
                      })
                    }
                  />
                  {t.title}
                </label>
              ))}
              {!tasks.isLoading && !tasks.tasks.length && (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Nenhuma tarefa disponível. Você pode seguir sem vincular.
                </p>
              )}
            </div>
          )}
          {current.key === "horizon" && (
            <div className="grid gap-3">
              {(
                [
                  ["curto", "Curto prazo"],
                  ["medio", "Médio prazo"],
                  ["longo", "Longo prazo"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={`${field} text-left ${draft.horizon === value ? "border-amber-400" : ""}`}
                  aria-pressed={draft.horizon === value}
                  onClick={() => setDraft({ ...draft, horizon: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {current.key === "priority" && (
            <div className="grid gap-3">
              {(
                [
                  ["baixa", "Baixa"],
                  ["media", "Média"],
                  ["alta", "Alta"],
                  ["urgente", "Urgente"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={`${field} text-left ${draft.priority === value ? "border-amber-400" : ""}`}
                  aria-pressed={draft.priority === value}
                  onClick={() => setDraft({ ...draft, priority: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {["start_date", "due_date"].includes(current.key) && (
            <>
              <input
                ref={input}
                data-answer
                type="date"
                aria-label={questions[current.key]}
                className={field}
                value={draft[current.key as "start_date"]}
                onChange={(e) =>
                  setDraft({ ...draft, [current.key]: e.target.value })
                }
              />
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                Opcional. As datas serão aplicadas às quatro áreas.
              </p>
            </>
          )}
          {current.key === "tags" && (
            <TagSelector
              scope="workspace"
              value={draft.tags}
              onChange={(tags) => setDraft({ ...draft, tags })}
              helperText="Compartilhadas apenas entre tarefas e objetivos. Também serão aplicadas às novas tarefas."
            />
          )}
          {current.key === "review" && (
            <div className="space-y-3">
              <p className="text-lg">{draft.title}</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Um card em cada área, com metas acumuladas independentes. As
                tarefas existentes mantêm seus responsáveis e prazos.
              </p>
              {draft.areas.map((a, i) => (
                <button
                  key={a.perspective}
                  className="block w-full rounded-xl border border-[var(--border)] p-3 text-left"
                  onClick={() => setStep(1 + i * areaSteps.length)}
                >
                  <strong className="text-sm">
                    {BSC_COLORS[a.perspective].name}
                  </strong>
                  <p className="mt-1 text-xs">
                    {a.indicator} · Meta: {a.target} {a.unit}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {a.tasks.split("\n").filter((t) => t.trim()).length} novas
                    tarefas · {a.task_ids.length} vinculadas · Editar
                  </p>
                </button>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-red-400">
              {error}
            </p>
          )}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            disabled={step === 0 || busy}
            onClick={() => {
              setError(null);
              setStep((s) => s - 1);
            }}
            className="flex items-center gap-2 text-sm disabled:opacity-30"
          >
            <ArrowLeft size={16} />
            Voltar
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (step === steps.length - 1) void submit();
              else next();
            }}
            className="lc-btn flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            {busy
              ? "Salvando…"
              : step === steps.length - 1
                ? "Cadastrar objetivo"
                : "Continuar"}
            {step === steps.length - 1 ? (
              <Check size={16} />
            ) : (
              <ArrowRight size={16} />
            )}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
