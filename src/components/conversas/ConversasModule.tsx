"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Archive,
  Bot,
  CalendarCheck,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Copy,
  Filter,
  FileText,
  GitBranch,
  Hourglass,
  MessageCircle,
  MoveRight,
  Phone,
  Play,
  Plus,
  QrCode,
  Save,
  Search,
  Send,
  Smartphone,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { useConversationsDashboard } from "@/hooks/useConversationsDashboard";
import type {
  ConversationFlow,
  ConversationFlowEdge,
  ConversationFlowNode,
  ConversationFlowNodeType,
  ConversationInboxItem,
  ConversationMessage,
  ConversationWhatsAppAccount,
} from "@/types/conversations";

type TabId = "conversas" | "contas" | "fluxos";

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
  { id: "conversas", label: "Conversas", icon: MessageCircle },
  { id: "contas", label: "Contas WhatsApp", icon: Smartphone },
  { id: "fluxos", label: "Fluxos", icon: GitBranch },
];

const statusLabels: Record<ConversationWhatsAppAccount["status"], string> = {
  connected: "Conectada",
  awaiting_qr: "Aguardando QR Code",
  connecting: "Conectando",
  disconnected: "Desconectada",
  error: "Erro",
  expired: "Expirada",
  reconnect: "Reconectar",
};

function initials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

function formatTime(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function accountStatusColor(status: ConversationWhatsAppAccount["status"]) {
  if (status === "connected") return "#34d399";
  if (status === "awaiting_qr" || status === "connecting") return "#38bdf8";
  if (status === "reconnect" || status === "expired") return "#d97706";
  return "#ef4444";
}

function MetricCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent: string }) {
  return (
    <div className="lc-card p-4" style={{ background: "var(--glass-bg-soft)" }}>
      <p className="text-[12px]" style={{ color: "var(--muted-foreground)" }}>{label}</p>
      <p className="mt-2 text-2xl font-bold" style={{ color: accent }}>{value}</p>
      <p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{hint}</p>
    </div>
  );
}

function TabBar({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <div className="lc-card flex flex-wrap items-center gap-1 p-1.5" style={{ background: "var(--glass-bg-soft)" }}>
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: isActive ? "var(--surface)" : "transparent",
              color: isActive ? "var(--text-title)" : "var(--muted-foreground)",
              border: isActive ? "1px solid var(--glass-border)" : "1px solid transparent",
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ConversationListItem({ item, active, onClick }: {
  item: ConversationInboxItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5"
      style={{
        background: active ? "var(--hover)" : "transparent",
        border: active ? "1px solid var(--glass-border)" : "1px solid transparent",
      }}
    >
      <div className="flex items-start gap-3">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: "var(--primary)", color: "#ffffff" }}>
          {initials(item.contact.name)}
          {item.thread.needs_response && (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full" style={{ background: "#ef4444", border: "2px solid var(--surface)" }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>{item.contact.name ?? item.contact.phone}</p>
            <span className="shrink-0 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{formatTime(item.thread.last_message_at)}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--muted-foreground)" }}>{item.thread.last_message_preview}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="truncate text-[11px]" style={{ color: "var(--muted-foreground)" }}>{item.ownerName} · {item.account?.session_name ?? "Sem conta"}</span>
            {item.thread.unread_count > 0 && (
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "#ef4444", color: "#ffffff" }}>
                {item.thread.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const outbound = message.direction === "outbound";
  return (
    <div className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[78%] rounded-2xl px-4 py-2.5"
        style={{
          background: outbound ? "var(--primary)" : "var(--hover)",
          color: outbound ? "#ffffff" : "var(--text-title)",
          border: outbound ? "1px solid transparent" : "1px solid var(--glass-border)",
        }}
      >
        {message.source === "automation" && (
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: outbound ? "rgba(255,255,255,0.72)" : "var(--muted-foreground)" }}>
            <Bot size={11} />
            Automação
          </div>
        )}
        <p className="text-sm leading-relaxed">{message.body}</p>
        {message.error && (
          <p className="mt-1 text-[10px]" style={{ color: outbound ? "rgba(255,255,255,0.78)" : "#ef4444" }}>
            {message.error}
          </p>
        )}
        <p className="mt-1 text-right text-[10px]" style={{ color: outbound ? "rgba(255,255,255,0.72)" : "var(--muted-foreground)" }}>
          {formatTime(message.created_at)} · {message.status}
        </p>
      </div>
    </div>
  );
}

function ConversasInbox() {
  const { accounts, inbox, messages, metrics, isLoading, isMutating, sendMessage, createConversation } = useConversationsDashboard();
  const [selectedId, setSelectedId] = useState(inbox[0]?.thread.id ?? "");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const selected = inbox.find((item) => item.thread.id === selectedId) ?? inbox[0];
  const visibleInbox = inbox.filter((item) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return [
      item.contact.name,
      item.contact.phone,
      item.thread.last_message_preview,
      item.account?.session_name,
      item.ownerName,
    ].some((value) => value?.toLowerCase().includes(q));
  });
  const visibleMessages = messages.filter((message) => message.thread_id === selected?.thread.id);

  async function handleSendMessage() {
    if (!selected || !draft.trim() || isMutating) return;
    const sent = await sendMessage(selected.thread.id, draft);
    if (sent) setDraft("");
  }

  async function handleCreateConversation(input: { name: string; phone: string; whatsappAccountId: string }) {
    const thread = await createConversation({
      name: input.name,
      phone: input.phone,
      whatsappAccountId: input.whatsappAccountId || null,
    });
    if (!thread) return;
    setSelectedId(thread.id);
    setShowNewConversation(false);
  }

  return (
    <div className="space-y-4">
      <div className="grid min-h-[680px] grid-cols-1 gap-4 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
        <div className="lc-card flex min-h-0 flex-col overflow-hidden" style={{ background: "var(--glass-bg-soft)" }}>
          <div className="border-b p-4" style={{ borderColor: "var(--glass-border)" }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Caixa de entrada</h2>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>WhatsApp da equipe</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewConversation(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: "var(--primary)", color: "#ffffff" }}
                  aria-label="Nova conversa"
                >
                  <UserPlus size={15} />
                </button>
                <Filter size={16} style={{ color: "var(--muted-foreground)" }} />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
              <Search size={14} style={{ color: "var(--muted-foreground)" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nome, telefone ou mensagem"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
                style={{ color: "var(--text-title)" }}
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {isLoading ? (
              <EmptyState icon={MessageCircle} title="Carregando conversas" description="Buscando inbox no Supabase..." compact />
            ) : visibleInbox.length > 0 ? (
              visibleInbox.map((item) => (
                <ConversationListItem
                  key={item.thread.id}
                  item={item}
                  active={selected?.thread.id === item.thread.id}
                  onClick={() => setSelectedId(item.thread.id)}
                />
              ))
            ) : (
              <EmptyState icon={MessageCircle} title="Nenhuma conversa" description="As conversas aparecerão aqui quando o worker WhatsApp registrar mensagens." compact />
            )}
          </div>
        </div>

        <div className="lc-card flex min-h-0 flex-col overflow-hidden" style={{ background: "var(--glass-bg-soft)" }}>
          {selected ? (
            <>
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--glass-border)" }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold" style={{ background: "var(--primary)", color: "#ffffff" }}>
                    {initials(selected.contact.name)}
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>{selected.contact.name ?? selected.contact.phone}</h2>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{selected.contact.phone}</p>
                  </div>
                </div>
                <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: selected.thread.needs_response ? "rgba(239,68,68,0.12)" : "rgba(52,211,153,0.12)", color: selected.thread.needs_response ? "#ef4444" : "#34d399" }}>
                  {selected.thread.needs_response ? "Não respondida" : "Em dia"}
                </span>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
                {visibleMessages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>
              <div className="border-t p-4" style={{ borderColor: "var(--glass-border)" }}>
                <div className="flex items-center gap-3 rounded-2xl p-2" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    placeholder="Escrever mensagem manual..."
                    className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-[var(--muted-foreground)]"
                    style={{ color: "var(--text-title)" }}
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendMessage()}
                    disabled={!draft.trim() || isMutating}
                    className="flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-50"
                    style={{ background: "var(--primary)", color: "#ffffff" }}
                    aria-label="Enviar mensagem"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState icon={MessageCircle} title="Selecione uma conversa" description="Quando houver conversas no inbox, o chat será exibido aqui." />
          )}
        </div>

        <div className="lc-card p-5" style={{ background: "var(--glass-bg-soft)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Dados do contato</h2>
          {selected && (
            <div className="mt-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold" style={{ background: "var(--primary)", color: "#ffffff" }}>
                  {initials(selected.contact.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold" style={{ color: "var(--text-title)" }}>{selected.contact.name}</p>
                  <p className="truncate text-xs" style={{ color: "var(--muted-foreground)" }}>{selected.contact.company ?? "Sem empresa"}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <InfoRow icon={Phone} label="Telefone" value={selected.contact.phone} />
                <InfoRow icon={UserRound} label="Responsável" value={selected.ownerName} />
                <InfoRow icon={Smartphone} label="Conta" value={selected.account?.session_name ?? "Sem conta"} />
                <InfoRow icon={Clock3} label="Última mensagem" value={formatTime(selected.thread.last_message_at)} />
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text-title)" }}>Contexto CRM</p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  Vinculação preparada para lead, pipeline, etapa, IQ/IE e responsável.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showNewConversation && (
          <NewConversationModal
            accounts={accounts}
            isMutating={isMutating}
            onClose={() => setShowNewConversation(false)}
            onSubmit={(input) => void handleCreateConversation(input)}
          />
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Conversas abertas" value={String(metrics.openThreads)} hint="Inbox da equipe" accent="#38bdf8" />
        <MetricCard label="Sem resposta" value={String(metrics.needsResponse)} hint="Última mensagem recebida" accent="#d97706" />
        <MetricCard label="Taxa de resposta" value={`${metrics.responseRate}%`} hint="Respostas no período" accent="#34d399" />
        <MetricCard label="Tempo médio" value={`${metrics.averageResponseMinutes}m`} hint="Até primeira resposta" accent="#a78bfa" />
      </div>
    </div>
  );
}

function NewConversationModal({
  accounts,
  isMutating,
  onClose,
  onSubmit,
}: {
  accounts: ConversationWhatsAppAccount[];
  isMutating: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; phone: string; whatsappAccountId: string }) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappAccountId, setWhatsappAccountId] = useState(accounts[0]?.id ?? "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phone.trim() || isMutating) return;
    onSubmit({ name, phone, whatsappAccountId });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }}
      />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        className="lc-modal-panel relative w-full max-w-md overflow-hidden rounded-2xl p-6 shadow-2xl"
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-[var(--hover)]" aria-label="Fechar">
          <X size={16} style={{ color: "var(--muted-foreground)" }} />
        </button>
        <div className="pr-8">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Nova conversa</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            Crie um contato e abra uma thread no inbox.
          </p>
        </div>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Nome</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Maria Silva"
              className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Telefone</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Ex.: 5585999999999"
              className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Conta WhatsApp</span>
            <select
              value={whatsappAccountId}
              onChange={(event) => setWhatsappAccountId(event.target.value)}
              className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
            >
              <option value="">Sem conta vinculada</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.session_name} · {statusLabels[account.status]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
            Cancelar
          </button>
          <button type="submit" disabled={!phone.trim() || isMutating} className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--primary)", color: "#ffffff" }}>
            {isMutating ? "Criando..." : "Criar conversa"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
      <Icon size={14} style={{ color: "var(--muted-foreground)" }} />
      <div className="min-w-0">
        <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{label}</p>
        <p className="truncate text-sm font-medium" style={{ color: "var(--text-title)" }}>{value}</p>
      </div>
    </div>
  );
}

function AccountsTab() {
  const { accounts, createAccount, startConnection, disconnectAccount, deleteAccount, isMutating } = useConversationsDashboard();
  const [qrAccount, setQrAccount] = useState<ConversationWhatsAppAccount | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const primaryAccount = accounts.find((account) => account.status === "connected")
    ?? accounts.find((account) => account.status === "awaiting_qr" || account.status === "connecting")
    ?? accounts[0]
    ?? null;
  const historyAccounts = accounts.filter((account) => account.id !== primaryAccount?.id);

  async function handleCreateAndConnect() {
    const account = primaryAccount ?? await createAccount();
    if (!account) return;
    const connected = await startConnection(account.id);
    setQrAccount(connected ?? account);
  }

  async function handleStartConnection(account: ConversationWhatsAppAccount) {
    const updated = await startConnection(account.id);
    setQrAccount(updated ?? account);
  }

  async function handleClearHistory() {
    for (const account of historyAccounts) {
      await deleteAccount(account.id);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="Contas conectadas" value={String(accounts.filter((account) => account.status === "connected").length)} hint="Sessões online" accent="#34d399" />
        <MetricCard label="Reconectar" value={String(accounts.filter((account) => account.status === "reconnect" || account.status === "expired").length)} hint="Precisam de QR Code" accent="#d97706" />
        <MetricCard label="Provider ativo" value="QR Code" hint="WhatsApp Web adapter" accent="#38bdf8" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <button
          type="button"
          onClick={() => void handleCreateAndConnect()}
          disabled={isMutating}
          className="lc-card flex min-h-[220px] flex-col items-center justify-center gap-4 p-6 text-center transition-all hover:-translate-y-0.5"
          style={{ background: "var(--glass-bg-soft)", borderStyle: "dashed" }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
            <QrCode size={28} />
          </div>
          <div>
            <h2 className="font-semibold" style={{ color: "var(--text-title)" }}>{primaryAccount ? "Conectar conta principal" : "Conectar WhatsApp"}</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
              {isMutating ? "Preparando sessão..." : primaryAccount ? "Reutiliza a tentativa mais recente." : "Leia o QR Code no WhatsApp Business/App."}
            </p>
          </div>
        </button>

        {primaryAccount ? (
          <div className="lc-card p-5" style={{ background: "var(--glass-bg-soft)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>Conta principal</p>
                <h2 className="mt-1 font-semibold" style={{ color: "var(--text-title)" }}>{primaryAccount.session_name}</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{primaryAccount.phone ?? "Telefone pendente"}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${accountStatusColor(primaryAccount.status)}18`, color: accountStatusColor(primaryAccount.status) }}>
                {primaryAccount.status === "connected" ? <Wifi size={20} /> : <WifiOff size={20} />}
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <InfoPill label="Status" value={statusLabels[primaryAccount.status]} color={accountStatusColor(primaryAccount.status)} />
              <InfoPill label="Última sincronização" value={primaryAccount.last_sync_at ? new Date(primaryAccount.last_sync_at).toLocaleString("pt-BR") : "Nunca"} />
              <InfoPill label="Provider" value="QR Code" />
            </div>
            {primaryAccount.last_error && (
              <div className="mt-4 rounded-2xl p-3 text-xs" style={{ background: "rgba(217,119,6,0.10)", color: "#d97706", border: "1px solid rgba(217,119,6,0.22)" }}>
                {primaryAccount.last_error}
                {primaryAccount.last_error.includes("WHATSAPP_QR_WORKER") && (
                  <p className="mt-2 leading-relaxed">
                    Verifique se as variáveis foram adicionadas em Production na Vercel e faça um novo redeploy.
                  </p>
                )}
              </div>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              <button onClick={() => void handleStartConnection(primaryAccount)} disabled={isMutating} className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--primary)", color: "#ffffff" }}>
                {primaryAccount.status === "connected" ? "Ver status" : "Reconectar"}
              </button>
              <button onClick={() => void disconnectAccount(primaryAccount.id)} disabled={isMutating} className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                Desconectar
              </button>
              <button onClick={() => void deleteAccount(primaryAccount.id)} disabled={isMutating} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.22)" }}>
                <Trash2 size={14} /> Apagar
              </button>
            </div>
          </div>
        ) : (
          <div className="lc-card flex min-h-[220px] items-center justify-center p-6 text-center" style={{ background: "var(--glass-bg-soft)" }}>
            <EmptyState icon={Smartphone} title="Nenhuma conta criada" description="Clique em Conectar WhatsApp para iniciar uma sessão QR Code." compact />
          </div>
        )}
      </div>

      {historyAccounts.length > 0 && (
        <div className="lc-card overflow-hidden" style={{ background: "var(--glass-bg-soft)" }}>
          <button
            type="button"
            onClick={() => setShowHistory((current) => !current)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
          >
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Histórico de tentativas</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>{historyAccounts.length} conta(s) antiga(s) ocultas para manter a tela limpa.</p>
            </div>
            <ChevronDown size={18} className={`transition-transform ${showHistory ? "rotate-180" : ""}`} style={{ color: "var(--muted-foreground)" }} />
          </button>

          {showHistory && (
            <div className="border-t p-4" style={{ borderColor: "var(--glass-border)" }}>
              <div className="mb-3 flex justify-end">
                <button type="button" onClick={() => void handleClearHistory()} disabled={isMutating} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.22)" }}>
                  <Trash2 size={13} /> Limpar histórico
                </button>
              </div>
              <div className="space-y-2">
                {historyAccounts.map((account) => (
                  <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>{account.session_name}</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {statusLabels[account.status]} · {account.last_sync_at ? new Date(account.last_sync_at).toLocaleString("pt-BR") : "Nunca sincronizada"}
                      </p>
                    </div>
                    <button type="button" onClick={() => void deleteAccount(account.id)} disabled={isMutating} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.22)" }}>
                      <Trash2 size={13} /> Apagar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {qrAccount && <QrModal account={qrAccount} onClose={() => setQrAccount(null)} />}
      </AnimatePresence>
    </div>
  );
}

function InfoPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
      <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color: color ?? "var(--text-title)" }}>{value}</span>
    </div>
  );
}

function QrModal({ account, onClose }: { account: ConversationWhatsAppAccount; onClose: () => void }) {
  const qrImageUrl = account.qr_code_payload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(account.qr_code_payload)}`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }} />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        className="lc-modal-panel relative w-full max-w-md overflow-hidden rounded-2xl p-6 shadow-2xl"
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-[var(--hover)]" aria-label="Fechar">
          <X size={16} style={{ color: "var(--muted-foreground)" }} />
        </button>
        <div className="pr-8">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Conectar WhatsApp</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{account.session_name}</p>
        </div>
        {account.qr_code_payload ? (
          <div className="mx-auto mt-6 flex h-64 w-64 items-center justify-center rounded-2xl p-3" style={{ background: "#ffffff" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrImageUrl} alt="QR Code real para conectar WhatsApp" className="h-full w-full rounded-xl object-contain" />
          </div>
        ) : (
          <div className="mx-auto mt-6 flex h-64 w-64 flex-col items-center justify-center rounded-2xl p-6 text-center" style={{ background: "var(--hover)", border: "1px dashed var(--glass-border)" }}>
            <QrCode size={34} style={{ color: "var(--muted-foreground)" }} />
            <p className="mt-4 text-sm font-semibold" style={{ color: "var(--text-title)" }}>QR Code ainda não disponível</p>
            <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              O worker precisa retornar um payload de QR real para esta sessão.
            </p>
          </div>
        )}
        <div className="mt-6 rounded-2xl p-4" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Como conectar</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Abra o WhatsApp, acesse Aparelhos conectados e leia o QR Code real exibido acima.
          </p>
          {account.qr_code_payload && (
            <p className="mt-3 break-all rounded-xl px-3 py-2 text-[11px]" style={{ background: "var(--surface)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}>
              {account.qr_code_payload}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

type FlowBlockCategory = "trigger" | "logic" | "action";

type FlowBlockDefinition = {
  id: string;
  category: FlowBlockCategory;
  nodeType: ConversationFlowNodeType;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  initialConfig?: Record<string, unknown>;
  locked?: boolean;
};

const flowCategoryMeta: Record<FlowBlockCategory, { label: string; color: string }> = {
  trigger: { label: "Gatilhos", color: "#38bdf8" },
  logic: { label: "Lógica", color: "#a78bfa" },
  action: { label: "Ações", color: "#34d399" },
};

const triggerEventLabels: Record<string, string> = {
  form_submitted: "Formulário preenchido",
  appointment_created: "Agendamento realizado",
  lead_created: "Lead criado",
  message_received: "Mensagem recebida",
  stage_changed: "Etapa do CRM alterada",
};

const triggerEventDescriptions: Record<string, string> = {
  form_submitted: "Inicia quando uma resposta de formulário entra.",
  appointment_created: "Inicia quando um agendamento é criado.",
  lead_created: "Inicia quando um lead entra no CRM.",
  message_received: "Inicia quando uma mensagem inbound chega no WhatsApp.",
  stage_changed: "Inicia quando um lead muda de etapa no CRM.",
};

const flowBlockLibrary: FlowBlockDefinition[] = [
  {
    id: "form_submitted",
    category: "trigger",
    nodeType: "trigger",
    name: "Formulário preenchido",
    description: "Inicia quando uma resposta entra.",
    icon: FileText,
    color: flowCategoryMeta.trigger.color,
    initialConfig: { trigger_type: "form_submitted" },
  },
  {
    id: "appointment_created",
    category: "trigger",
    nodeType: "trigger",
    name: "Agendamento realizado",
    description: "Dispara ao criar um agendamento.",
    icon: CalendarCheck,
    color: flowCategoryMeta.trigger.color,
    initialConfig: { trigger_type: "appointment_created" },
  },
  {
    id: "lead_created",
    category: "trigger",
    nodeType: "trigger",
    name: "Lead criado",
    description: "Dispara quando um lead entra no CRM.",
    icon: UserPlus,
    color: flowCategoryMeta.trigger.color,
    initialConfig: { trigger_type: "lead_created" },
  },
  {
    id: "message_received",
    category: "trigger",
    nodeType: "trigger",
    name: "Mensagem recebida",
    description: "Dispara quando chega uma mensagem no WhatsApp.",
    icon: MessageCircle,
    color: flowCategoryMeta.trigger.color,
    initialConfig: { trigger_type: "message_received" },
  },
  {
    id: "stage_changed",
    category: "trigger",
    nodeType: "trigger",
    name: "Etapa do CRM alterada",
    description: "Dispara quando um lead muda de etapa.",
    icon: MoveRight,
    color: flowCategoryMeta.trigger.color,
    initialConfig: { trigger_type: "stage_changed" },
  },
  {
    id: "wait_timer",
    category: "logic",
    nodeType: "wait",
    name: "Timer / Espera",
    description: "Aguarda minutos, horas ou dias.",
    icon: Hourglass,
    color: flowCategoryMeta.logic.color,
    initialConfig: { wait_minutes: 10 },
  },
  {
    id: "send_whatsapp",
    category: "action",
    nodeType: "action",
    name: "Enviar WhatsApp",
    description: "Envia uma mensagem automática.",
    icon: MessageCircle,
    color: flowCategoryMeta.action.color,
    initialConfig: { action_type: "send_message", message: "" },
  },
  {
    id: "move_crm",
    category: "action",
    nodeType: "action",
    name: "Mover no CRM",
    description: "Move o lead para uma etapa.",
    icon: MoveRight,
    color: flowCategoryMeta.action.color,
    initialConfig: { action_type: "move_crm" },
  },
];

function categoryForNode(node: ConversationFlowNode): FlowBlockCategory {
  if (node.node_type === "trigger") return "trigger";
  if (node.node_type === "wait" || node.node_type === "condition") return "logic";
  return "action";
}

function nodeColor(node: ConversationFlowNode) {
  return flowCategoryMeta[categoryForNode(node)].color;
}

function nodeIcon(node: ConversationFlowNode) {
  if (node.node_type === "trigger") return FileText;
  if (node.node_type === "wait") return Hourglass;
  if (node.node_type === "condition") return GitBranch;
  if (node.node_type === "end") return CheckCircle2;
  if (node.config?.action_type === "move_crm") return MoveRight;
  return MessageCircle;
}

function nodeDescription(node: ConversationFlowNode) {
  if (node.node_type === "trigger") {
    const triggerType = typeof node.config?.trigger_type === "string" ? node.config.trigger_type : "";
    return triggerEventDescriptions[triggerType] ?? "Ponto de entrada da automação";
  }
  if (node.node_type === "wait") {
    const waitValue = Number(node.config?.wait_value ?? node.config?.wait_minutes ?? 0);
    const waitUnit = node.config?.wait_unit === "seconds" ? "segundo(s)" : "minuto(s)";
    return `${waitValue} ${waitUnit} de espera`;
  }
  if (node.node_type === "condition") return "Valida dados antes de continuar";
  if (node.node_type === "end") return "Finaliza a jornada";
  if (node.config?.action_type === "move_crm") return "Atualiza etapa do lead";
  return "Envia mensagem pelo WhatsApp";
}

function flowRunColor(status: string) {
  if (status === "executed") return "#34d399";
  if (status === "cancelled") return "#d97706";
  return "#ef4444";
}

function flowLogColor(level: string) {
  if (level === "info") return "#38bdf8";
  if (level === "warning") return "#d97706";
  return "#ef4444";
}

function formatDateTime(date: string | null) {
  if (!date) return "";
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FlowsTab() {
  const { inbox, flows, metrics, resources, isLoading, isMutating, error, createFlow, updateFlowStatus, deleteFlow, testFlow, addFlowNode, updateFlowNode, deleteFlowNode, createFlowEdge, deleteFlowEdge } = useConversationsDashboard();
  const [selectedId, setSelectedId] = useState(flows[0]?.id ?? "");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [showNewFlow, setShowNewFlow] = useState(false);
  const [showTestFlow, setShowTestFlow] = useState(false);
  const [quickInsertAfter, setQuickInsertAfter] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [selectedEdgeId, setSelectedEdgeId] = useState("");
  const [connectionDraft, setConnectionDraft] = useState<{
    sourceKey: string;
    pointer: { x: number; y: number };
  } | null>(null);
  const [draftPositions, setDraftPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [dragState, setDragState] = useState<{
    nodeId: string;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const canvasInnerRef = useRef<HTMLDivElement | null>(null);
  const selected = flows.find((flow) => flow.id === selectedId) ?? flows[0];
  const selectedNodes = selected?.nodes ?? [];
  const selectedEdges = selected?.edges ?? [];
  const selectedNode = selectedNodes.find((node) => node.id === selectedNodeId) ?? selectedNodes[0] ?? null;
  const filteredQuickBlocks = flowBlockLibrary.filter((block) => !block.locked && block.name.toLowerCase().includes(quickSearch.toLowerCase()));

  useEffect(() => {
    setDraftPositions({});
    setSelectedEdgeId("");
    setConnectionDraft(null);
    setDragState(null);
  }, [selected?.id]);

  async function handleCreateFlow(input: {
    name: string;
    description: string;
  }) {
    const flow = await createFlow(input);
    if (!flow) return;
    setSelectedId(flow.id);
    setShowNewFlow(false);
  }

  async function handleAddBlock(block: FlowBlockDefinition, position?: { x: number; y: number } | null) {
    if (!selected) return;
    const node = await addFlowNode(selected.id, {
      nodeType: block.nodeType,
      label: block.name,
      config: block.initialConfig ?? {},
    });
    if (!node) return;
    if (position) {
      await updateFlowNode(selected.id, node.id, {
        position,
      });
    }
    setQuickInsertAfter("");
    setSelectedNodeId(node.id);
  }

  async function handleStatusChange(status: ConversationFlow["status"]) {
    if (!selected) return;
    const flow = await updateFlowStatus(selected.id, status);
    if (flow) setSelectedId(flow.id);
  }

  async function handleDeleteFlow() {
    if (!selected) return;
    const confirmed = window.confirm(`Apagar o fluxo "${selected.name}"? Essa ação não pode ser desfeita.`);
    if (!confirmed) return;
    const ok = await deleteFlow(selected.id);
    if (!ok) return;
    const nextFlow = flows.find((flow) => flow.id !== selected.id);
    setSelectedId(nextFlow?.id ?? "");
    setSelectedNodeId("");
  }

  async function handleDeleteNode(nodeId: string) {
    if (!selected || !nodeId) return;
    const ok = await deleteFlowNode(selected.id, nodeId);
    if (ok) setSelectedNodeId("");
  }

  async function handleUpdateNode(nodeId: string, input: { label: string; config: Record<string, unknown> }) {
    if (!selected || !nodeId) return;
    const node = await updateFlowNode(selected.id, nodeId, input);
    if (node) setSelectedNodeId(node.id);
  }

  async function handleTestFlow(threadId: string) {
    if (!selected) return;
    const ok = await testFlow(selected.id, threadId || null);
    if (ok) setShowTestFlow(false);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const block = flowBlockLibrary.find((item) => item.id === event.dataTransfer.getData("application/x-genesy-flow-block"));
    if (!block || block.locked) return;
    const point = getCanvasPoint(event);
    void handleAddBlock(block, point ? { x: Math.max(24, point.x - 180), y: Math.max(24, point.y - 40) } : null);
  }

  function getCanvasPoint(event: { clientX: number; clientY: number }) {
    const rect = canvasInnerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function getNodePosition(node: ConversationFlowNode, index: number) {
    const draft = draftPositions[node.id];
    if (draft) return draft;
    return {
      x: Number(node.position?.x ?? 360),
      y: Number(node.position?.y ?? 120 + index * 150),
    };
  }

  function getNodeCenter(node: ConversationFlowNode, index: number, port: "in" | "out") {
    const position = getNodePosition(node, index);
    return {
      x: position.x + 180,
      y: position.y + (port === "in" ? 0 : 84),
    };
  }

  function edgePath(source: ConversationFlowNode, sourceIndex: number, target: ConversationFlowNode, targetIndex: number) {
    const start = getNodeCenter(source, sourceIndex, "out");
    const end = getNodeCenter(target, targetIndex, "in");
    return connectionPath(start, end);
  }

  function connectionPath(start: { x: number; y: number }, end: { x: number; y: number }) {
    const dy = end.y - start.y;
    const bend = Math.max(64, Math.abs(dy) * 0.35);
    return `M ${start.x} ${start.y} C ${start.x} ${start.y + bend}, ${end.x} ${end.y - bend}, ${end.x} ${end.y}`;
  }

  function handleNodePointerDown(event: React.PointerEvent<HTMLButtonElement>, node: ConversationFlowNode, index: number) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-flow-port]") || target.closest("[data-flow-action]")) return;
    const point = getCanvasPoint(event);
    if (!point) return;
    const position = getNodePosition(node, index);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      nodeId: node.id,
      offsetX: point.x - position.x,
      offsetY: point.y - position.y,
      moved: false,
    });
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (connectionDraft) {
      const point = getCanvasPoint(event);
      if (point) {
        setConnectionDraft((current) => current ? { ...current, pointer: point } : null);
      }
      return;
    }
    if (!dragState) return;
    const point = getCanvasPoint(event);
    if (!point) return;
    setDragState((current) => current ? { ...current, moved: true } : null);
    setDraftPositions((current) => ({
      ...current,
      [dragState.nodeId]: {
        x: Math.max(16, Math.min(1260, point.x - dragState.offsetX)),
        y: Math.max(16, Math.min(820, point.y - dragState.offsetY)),
      },
    }));
  }

  async function handleCanvasPointerUp() {
    if (!dragState || !selected) return;
    const node = selectedNodes.find((item) => item.id === dragState.nodeId);
    const position = draftPositions[dragState.nodeId];
    setDragState(null);
    if (!node || !position || !dragState.moved) return;
    await updateFlowNode(selected.id, node.id, { position });
  }

  async function handleCanvasPointerUpEvent(event: React.PointerEvent<HTMLElement>) {
    if (connectionDraft && selected) {
      const draft = connectionDraft;
      setConnectionDraft(null);
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const targetKey = element instanceof HTMLElement
        ? element.closest<HTMLElement>("[data-flow-port='in']")?.dataset.nodeKey ?? ""
        : "";

      if (targetKey && targetKey !== draft.sourceKey) {
        await createFlowEdge(selected.id, {
          sourceKey: draft.sourceKey,
          targetKey,
        });
      }
      return;
    }
    await handleCanvasPointerUp();
  }

  async function handleDeleteEdge(edge: ConversationFlowEdge) {
    if (!selected) return;
    await deleteFlowEdge(selected.id, edge.id);
    setSelectedEdgeId("");
  }

  const canvasWidth = Math.max(
    1320,
    ...selectedNodes.map((node, index) => getNodePosition(node, index).x + 460),
  );
  const canvasHeight = Math.max(
    900,
    ...selectedNodes.map((node, index) => getNodePosition(node, index).y + 220),
  );

  return (
    <>
      <div className="lc-card min-h-[calc(100vh-170px)] overflow-hidden" style={{ background: "var(--glass-bg-soft)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--glass-border)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <select
              value={selected?.id ?? ""}
              onChange={(event) => {
                setSelectedId(event.target.value);
                setSelectedNodeId("");
              }}
              className="max-w-[280px] rounded-full px-4 py-2 text-sm font-semibold outline-none"
              style={{ background: "var(--surface)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
            >
              {flows.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
            </select>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ background: selected?.status === "active" ? "rgba(52,211,153,0.12)" : "var(--hover)", color: selected?.status === "active" ? "#34d399" : "var(--muted-foreground)" }}>
              {selected?.status ?? "sem fluxo"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setShowNewFlow(true)} className="rounded-full px-3 py-2 text-xs font-semibold" style={{ background: "var(--surface)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
              Novo fluxo
            </button>
            <button type="button" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold" style={{ background: "var(--surface)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}>
              <Save size={13} /> Salvar
            </button>
            <button type="button" onClick={() => setShowTestFlow(true)} disabled={!selected || isMutating} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.22)" }}>
              <Play size={13} /> Testar fluxo
            </button>
            <button type="button" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold" style={{ background: "var(--surface)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}>
              <Copy size={13} /> Duplicar
            </button>
            {selected?.status === "active" ? (
              <button type="button" onClick={() => void handleStatusChange("paused")} disabled={isMutating} className="rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: "rgba(217,119,6,0.12)", color: "#d97706", border: "1px solid rgba(217,119,6,0.22)" }}>
                Pausar
              </button>
            ) : (
              <button type="button" onClick={() => void handleStatusChange("active")} disabled={!selected || isMutating} className="rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.22)" }}>
                Publicar
              </button>
            )}
            <button type="button" onClick={() => selected && void handleStatusChange("archived")} disabled={!selected || isMutating} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: "var(--surface)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}>
              <Archive size={13} /> Arquivar
            </button>
            <button type="button" onClick={() => void handleDeleteFlow()} disabled={!selected || isMutating} className="rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.22)" }}>
              Apagar
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.10)", color: "#fecaca", border: "1px solid rgba(239,68,68,0.24)" }}>
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid min-h-[calc(100vh-235px)] grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
          <aside className="border-r p-4" style={{ borderColor: "var(--glass-border)" }}>
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Biblioteca</h2>
              <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>Arraste blocos para o canvas.</p>
            </div>
            <div className="mt-5 space-y-5">
              {(Object.keys(flowCategoryMeta) as FlowBlockCategory[]).map((category) => (
                <div key={category}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: flowCategoryMeta[category].color }} />
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--muted-foreground)" }}>{flowCategoryMeta[category].label}</p>
                  </div>
                  <div className="space-y-2">
                    {flowBlockLibrary.filter((block) => block.category === category).map((block) => {
                      const Icon = block.icon;
                      return (
                        <button
                          key={block.id}
                          type="button"
                          draggable={!block.locked}
                          onDragStart={(event) => event.dataTransfer.setData("application/x-genesy-flow-block", block.id)}
                          className="group w-full cursor-grab rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={block.locked}
                          style={{ background: "rgba(255,255,255,0.035)", border: "1px solid var(--glass-border)", boxShadow: "0 16px 40px rgba(0,0,0,0.10)" }}
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${block.color}18`, color: block.color }}>
                              <Icon size={17} />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold" style={{ color: "var(--text-title)" }}>{block.name}</span>
                              <span className="mt-0.5 block text-xs leading-snug" style={{ color: "var(--muted-foreground)" }}>{block.description}</span>
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <main
            ref={canvasRef}
            className="relative overflow-auto p-6"
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={(event) => void handleCanvasPointerUpEvent(event)}
            onPointerLeave={(event) => void handleCanvasPointerUpEvent(event)}
            style={{
              backgroundImage: "radial-gradient(circle, rgba(148,163,184,0.20) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              backgroundColor: "rgba(255,255,255,0.015)",
            }}
          >
            {selected ? (
              <>
                <div className="pointer-events-none absolute left-5 top-5 rounded-full px-3 py-1.5 text-xs" style={{ background: "var(--glass-bg-soft)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}>
                  Zoom 100% · Arraste livre · {connectionDraft ? "Solte no ponto superior do destino" : "Arraste uma conexão pelo ponto inferior"}
                </div>
                <div
                  ref={canvasInnerRef}
                  className="relative"
                  style={{
                    width: canvasWidth,
                    height: Math.max(canvasHeight, 640),
                    minHeight: "calc(100vh - 300px)",
                  }}
                >
                  {selectedNodes.length === 0 && (
                    <div className="absolute left-1/2 top-1/2 max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[28px] p-8 text-center" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035))", border: "1px dashed var(--glass-border)", boxShadow: "0 24px 80px rgba(0,0,0,0.12)" }}>
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8" }}>
                        <GitBranch size={26} />
                      </div>
                      <h3 className="mt-4 text-base font-bold" style={{ color: "var(--text-title)" }}>Canvas vazio</h3>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                        Arraste um bloco da biblioteca para começar a desenhar este fluxo.
                      </p>
                    </div>
                  )}
                  <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={canvasWidth} height={canvasHeight} aria-hidden="true">
                    {selectedEdges.map((edge) => {
                      const sourceIndex = selectedNodes.findIndex((item) => item.node_key === edge.source_key);
                      const targetIndex = selectedNodes.findIndex((item) => item.node_key === edge.target_key);
                      const source = selectedNodes[sourceIndex];
                      const target = selectedNodes[targetIndex];
                      if (!source || !target) return null;
                      return (
                        <path
                          key={edge.id}
                          d={edgePath(source, sourceIndex, target, targetIndex)}
                          fill="none"
                          stroke={selectedEdgeId === edge.id ? "rgba(255,255,255,0.86)" : "rgba(56,189,248,0.52)"}
                          strokeWidth={selectedEdgeId === edge.id ? "3" : "2"}
                          strokeLinecap="round"
                        />
                      );
                    })}
                    {connectionDraft && (() => {
                      const sourceIndex = selectedNodes.findIndex((item) => item.node_key === connectionDraft.sourceKey);
                      const source = selectedNodes[sourceIndex];
                      if (!source) return null;
                      return (
                        <path
                          d={connectionPath(getNodeCenter(source, sourceIndex, "out"), connectionDraft.pointer)}
                          fill="none"
                          stroke="rgba(255,255,255,0.72)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeDasharray="7 8"
                        />
                      );
                    })()}
                  </svg>
                  <svg className="pointer-events-auto absolute left-0 top-0 overflow-visible" width={canvasWidth} height={canvasHeight} aria-hidden="true">
                    {selectedEdges.map((edge) => {
                      const sourceIndex = selectedNodes.findIndex((item) => item.node_key === edge.source_key);
                      const targetIndex = selectedNodes.findIndex((item) => item.node_key === edge.target_key);
                      const source = selectedNodes[sourceIndex];
                      const target = selectedNodes[targetIndex];
                      if (!source || !target) return null;
                      return (
                        <path
                          key={`${edge.id}-glow`}
                          d={edgePath(source, sourceIndex, target, targetIndex)}
                          fill="none"
                          stroke="transparent"
                          strokeWidth="20"
                          strokeLinecap="round"
                          className="cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedEdgeId(selectedEdgeId === edge.id ? "" : edge.id);
                          }}
                        />
                      );
                    })}
                  </svg>
                  {selectedEdges.filter((edge) => edge.id === selectedEdgeId).map((edge) => {
                    const sourceIndex = selectedNodes.findIndex((item) => item.node_key === edge.source_key);
                    const targetIndex = selectedNodes.findIndex((item) => item.node_key === edge.target_key);
                    const source = selectedNodes[sourceIndex];
                    const target = selectedNodes[targetIndex];
                    if (!source || !target) return null;
                    const sourcePoint = getNodeCenter(source, sourceIndex, "out");
                    const targetPoint = getNodeCenter(target, targetIndex, "in");
                    return (
                      <button
                        key={`${edge.id}-delete`}
                        type="button"
                        data-flow-action="edge"
                        onClick={() => void handleDeleteEdge(edge)}
                        className="absolute rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-lg"
                        style={{
                          left: (sourcePoint.x + targetPoint.x) / 2 - 42,
                          top: (sourcePoint.y + targetPoint.y) / 2 - 15,
                          background: "rgba(239,68,68,0.16)",
                          color: "#ef4444",
                          border: "1px solid rgba(239,68,68,0.24)",
                        }}
                      >
                        apagar
                      </button>
                    );
                  })}
                  {selectedNodes.map((node, index) => {
                    const Icon = nodeIcon(node);
                    const color = nodeColor(node);
                    const isSelected = selectedNode?.id === node.id;
                    const position = getNodePosition(node, index);
                    return (
                      <div
                        key={node.id}
                        className="absolute"
                        style={{ left: position.x, top: position.y, width: 360 }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (!dragState?.moved) setSelectedNodeId(node.id);
                          }}
                          onPointerDown={(event) => handleNodePointerDown(event, node, index)}
                          className="group relative w-full cursor-grab rounded-[24px] p-4 text-left transition-all active:cursor-grabbing"
                          style={{
                            background: "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.035))",
                            border: `1px solid ${isSelected ? color : "var(--glass-border)"}`,
                            boxShadow: isSelected ? `0 0 0 1px ${color}40, 0 24px 80px ${color}22` : "0 24px 70px rgba(0,0,0,0.14)",
                          }}
                        >
                          <span
                            data-flow-port="in"
                            data-node-key={node.node_key}
                            onPointerUp={(event) => {
                              event.stopPropagation();
                              void handleCanvasPointerUpEvent(event);
                            }}
                            className="absolute left-1/2 top-0 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-black/20"
                            style={{ background: connectionDraft && connectionDraft.sourceKey !== node.node_key ? "#38bdf8" : color, boxShadow: `0 0 20px ${color}` }}
                            title="Soltar conexão aqui"
                          />
                          <span
                            data-flow-port="out"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                              event.currentTarget.setPointerCapture(event.pointerId);
                              const point = getCanvasPoint(event);
                              setSelectedEdgeId("");
                              setConnectionDraft({
                                sourceKey: node.node_key,
                                pointer: point ?? getNodeCenter(node, index, "out"),
                              });
                            }}
                            className="absolute bottom-0 left-1/2 h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-4 ring-black/20 transition-transform hover:scale-125"
                            style={{ background: connectionDraft?.sourceKey === node.node_key ? "#ffffff" : color, boxShadow: `0 0 20px ${color}` }}
                            title="Arrastar para conectar"
                          />
                          <div className="flex items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${color}18`, color }}>
                              <Icon size={20} />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-bold" style={{ color: "var(--text-title)" }}>{node.label}</span>
                              <span className="mt-1 block text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{nodeDescription(node)}</span>
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                  <div className="absolute right-6 top-6 z-20">
                    <button
                      type="button"
                      onClick={() => setQuickInsertAfter(quickInsertAfter ? "" : "canvas")}
                      className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold"
                      style={{ background: "var(--surface)", color: "var(--text-title)", border: "1px solid var(--glass-border)", boxShadow: "0 18px 50px rgba(0,0,0,0.18)" }}
                    >
                      <Plus size={14} /> Adicionar bloco
                    </button>
                    {quickInsertAfter && (
                      <div className="absolute right-0 top-11 z-20 w-72 rounded-2xl p-3" style={{ background: "var(--surface)", border: "1px solid var(--glass-border)", boxShadow: "0 24px 80px rgba(0,0,0,0.22)" }}>
                        <p className="text-xs font-semibold" style={{ color: "var(--text-title)" }}>Adicionar bloco</p>
                        <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
                          <Search size={13} style={{ color: "var(--muted-foreground)" }} />
                          <input value={quickSearch} onChange={(event) => setQuickSearch(event.target.value)} placeholder="Pesquisar" className="min-w-0 flex-1 bg-transparent text-xs outline-none" style={{ color: "var(--text-title)" }} />
                        </div>
                        <div className="mt-2 max-h-52 space-y-1 overflow-auto">
                          {filteredQuickBlocks.map((block) => {
                            const BlockIcon = block.icon;
                            return (
                              <button key={block.id} type="button" onClick={() => void handleAddBlock(block, null)} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors hover:bg-[var(--hover)]">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: `${block.color}18`, color: block.color }}>
                                  <BlockIcon size={14} />
                                </span>
                                <span>
                                  <span className="block text-xs font-semibold" style={{ color: "var(--text-title)" }}>{block.name}</span>
                                  <span className="block text-[11px]" style={{ color: "var(--muted-foreground)" }}>{flowCategoryMeta[block.category].label}</span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <EmptyState icon={GitBranch} title="Nenhum fluxo selecionado" description="Crie o primeiro fluxo para abrir o canvas." />
            )}
          </main>

          <aside className="border-l p-4" style={{ borderColor: "var(--glass-border)" }}>
            <FlowInspector
              flow={selected}
              node={selectedNode}
              metrics={metrics}
              resources={resources}
              isMutating={isMutating}
              onTest={() => setShowTestFlow(true)}
              onPublish={() => selected && void handleStatusChange("active")}
              onDeleteFlow={() => void handleDeleteFlow()}
              onUpdateNode={(nodeId, input) => void handleUpdateNode(nodeId, input)}
              onDeleteNode={(nodeId) => void handleDeleteNode(nodeId)}
            />
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {showNewFlow && (
          <NewFlowModal
            isMutating={isMutating}
            onClose={() => setShowNewFlow(false)}
            onSubmit={(input) => void handleCreateFlow(input)}
          />
        )}
        {showTestFlow && selected && (
          <TestFlowModal
            inbox={inbox}
            isMutating={isMutating}
            onClose={() => setShowTestFlow(false)}
            onSubmit={(threadId) => void handleTestFlow(threadId)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function FlowInspector({
  flow,
  node,
  metrics,
  resources,
  isMutating,
  onTest,
  onPublish,
  onDeleteFlow,
  onUpdateNode,
  onDeleteNode,
}: {
  flow: ConversationFlow | undefined;
  node: ConversationFlowNode | null;
  metrics: ReturnType<typeof useConversationsDashboard>["metrics"];
  resources: ReturnType<typeof useConversationsDashboard>["resources"];
  isMutating: boolean;
  onTest: () => void;
  onPublish: () => void;
  onDeleteFlow: () => void;
  onUpdateNode: (nodeId: string, input: { label: string; config: Record<string, unknown> }) => void;
  onDeleteNode: (nodeId: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [targetScope, setTargetScope] = useState("all_leads");
  const [formId, setFormId] = useState("");
  const [skipWhenScheduled, setSkipWhenScheduled] = useState("true");
  const [calendarId, setCalendarId] = useState("");
  const [minIq, setMinIq] = useState("");
  const [minIe, setMinIe] = useState("");
  const [waitValue, setWaitValue] = useState("10");
  const [waitUnit, setWaitUnit] = useState("minutes");
  const [message, setMessage] = useState("");
  const [mediaType, setMediaType] = useState("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [conditionField, setConditionField] = useState("message_body");
  const [conditionOperator, setConditionOperator] = useState("contains");
  const [conditionValue, setConditionValue] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");

  useEffect(() => {
    if (!node) return;
    setLabel(node.label);
    setTargetScope(typeof node.config?.target_scope === "string" ? node.config.target_scope : "all_leads");
    setFormId(typeof node.config?.form_id === "string" ? node.config.form_id : "");
    setSkipWhenScheduled(node.config?.skip_when_scheduled === false ? "false" : "true");
    setCalendarId(typeof node.config?.calendar_id === "string" ? node.config.calendar_id : "");
    setMinIq(typeof node.config?.min_iq === "number" ? String(node.config.min_iq) : "");
    setMinIe(typeof node.config?.min_ie === "number" ? String(node.config.min_ie) : "");
    setWaitValue(String(node.config?.wait_value ?? node.config?.wait_minutes ?? "10"));
    setWaitUnit(typeof node.config?.wait_unit === "string" ? node.config.wait_unit : "minutes");
    setMessage(typeof node.config?.message === "string" ? node.config.message : "");
    setMediaType(typeof node.config?.media_type === "string" ? node.config.media_type : "none");
    setMediaUrl(typeof node.config?.media_url === "string" ? node.config.media_url : "");
    setConditionField(typeof node.config?.field === "string" ? node.config.field : "message_body");
    setConditionOperator(typeof node.config?.operator === "string" ? node.config.operator : "contains");
    setConditionValue(typeof node.config?.value === "string" ? node.config.value : "");
    setPipelineId(typeof node.config?.pipeline_id === "string" ? node.config.pipeline_id : "");
    setStageId(typeof node.config?.stage_id === "string" ? node.config.stage_id : "");
  }, [node]);

  if (!flow) {
    return <EmptyState icon={GitBranch} title="Sem fluxo" description="Crie ou selecione um fluxo para editar." compact />;
  }

  const Icon = node ? nodeIcon(node) : GitBranch;
  const color = node ? nodeColor(node) : "#38bdf8";
  const isMoveCrmNode = node?.node_type === "action" && node.config?.action_type === "move_crm";
  const fixedTriggerType = node?.node_type === "trigger" && typeof node.config?.trigger_type === "string"
    ? node.config.trigger_type
    : "";
  const fixedTriggerLabel = triggerEventLabels[fixedTriggerType] ?? "Gatilho não definido";
  const selectedPipeline = resources.pipelines.find((pipeline) => pipeline.id === pipelineId);
  const availableStages = (selectedPipeline?.crm_stages ?? []).filter((stage) => stage.is_active !== false);

  function buildNodeConfig() {
    if (!node) return {};
    if (node.node_type === "trigger") {
      return {
        ...node.config,
        trigger_type: fixedTriggerType,
        target_scope: targetScope,
        form_id: formId || null,
        skip_when_scheduled: skipWhenScheduled === "true",
        calendar_id: calendarId || null,
        pipeline_id: pipelineId || null,
        stage_id: stageId || null,
        message_operator: conditionOperator,
        message_value: conditionValue.trim() || null,
        min_iq: minIq.trim() ? Number(minIq) : null,
        min_ie: minIe.trim() ? Number(minIe) : null,
      };
    }
    if (node.node_type === "wait") {
      return {
        ...node.config,
        wait_value: Math.max(0, Number(waitValue) || 0),
        wait_unit: waitUnit,
        wait_minutes: waitUnit === "seconds"
          ? Math.max(0, Number(waitValue) || 0) / 60
          : Math.max(0, Number(waitValue) || 0),
      };
    }
    if (node.node_type === "condition") {
      return {
        ...node.config,
        field: conditionField,
        operator: conditionOperator,
        value: conditionValue,
      };
    }
    if (isMoveCrmNode) {
      return {
        ...node.config,
        action_type: "move_crm",
        pipeline_id: pipelineId || null,
        stage_id: stageId || null,
      };
    }
    return {
      ...node.config,
      action_type: "send_message",
      message,
      media_type: mediaType,
      media_url: mediaType === "none" ? null : mediaUrl.trim() || null,
    };
  }

  function handleSaveNode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!node || !label.trim() || isMutating) return;
    onUpdateNode(node.id, { label: label.trim(), config: buildNodeConfig() });
  }

  return (
    <div className="flex h-full flex-col">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>Configuração</p>
        <div className="mt-3 rounded-2xl p-4" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${color}18`, color }}>
              <Icon size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold" style={{ color: "var(--text-title)" }}>{node?.label ?? flow.name}</h3>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                {node ? nodeDescription(node) : flow.description || "Configurações gerais do fluxo"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {node ? (
        <form onSubmit={handleSaveNode} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Nome do bloco</span>
            <input value={label} onChange={(event) => setLabel(event.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }} />
          </label>

          {node.node_type === "trigger" && (
            <div className="space-y-3">
              <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.22)" }}>
                <span className="text-xs font-semibold" style={{ color: "#38bdf8" }}>Quando iniciar este fluxo</span>
                <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-title)" }}>{fixedTriggerLabel}</p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  Este evento é definido pelo bloco escolhido na biblioteca. Para trocar o evento, apague este gatilho e adicione outro bloco de gatilho.
                </p>
              </div>
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Executar para</span>
                <select value={targetScope} onChange={(event) => setTargetScope(event.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                  <option value="all_leads">Todos os leads elegíveis</option>
                  <option value="assigned_to_owner">Leads do responsável do fluxo</option>
                </select>
              </label>
              {fixedTriggerType === "form_submitted" && (
                <>
                  <label className="block">
                    <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Formulário</span>
                    <select value={formId} onChange={(event) => setFormId(event.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                      <option value="">Todos os formulários</option>
                      {resources.forms.map((form) => (
                        <option key={form.id} value={form.id}>{form.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Se houver agendamento no mesmo envio</span>
                    <select value={skipWhenScheduled} onChange={(event) => setSkipWhenScheduled(event.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                      <option value="true">Não disparar este fluxo de formulário</option>
                      <option value="false">Disparar mesmo assim</option>
                    </select>
                  </label>
                </>
              )}
              {fixedTriggerType === "appointment_created" && (
                <label className="block">
                  <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Calendário</span>
                  <select value={calendarId} onChange={(event) => setCalendarId(event.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                    <option value="">Todos os calendários</option>
                    {resources.calendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>{calendar.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {(fixedTriggerType === "lead_created" || fixedTriggerType === "stage_changed") && (
                <label className="block">
                  <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Pipeline</span>
                  <select value={pipelineId} onChange={(event) => { setPipelineId(event.target.value); setStageId(""); }} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                    <option value="">Todas as pipelines</option>
                    {resources.pipelines.map((pipeline) => (
                      <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {fixedTriggerType === "stage_changed" && (
                <label className="block">
                  <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Etapa de entrada</span>
                  <select value={stageId} onChange={(event) => setStageId(event.target.value)} disabled={!pipelineId} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none disabled:opacity-60" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                    <option value="">Todas as etapas</option>
                    {availableStages.map((stage) => (
                      <option key={stage.id} value={stage.id}>{stage.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {fixedTriggerType === "message_received" && (
                <div className="grid grid-cols-1 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Mensagem deve</span>
                    <select value={conditionOperator} onChange={(event) => setConditionOperator(event.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                      <option value="contains">Conter</option>
                      <option value="equals">Ser exatamente</option>
                      <option value="not_contains">Não conter</option>
                      <option value="not_empty">Estar preenchida</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Texto / palavra-chave</span>
                    <input value={conditionValue} onChange={(event) => setConditionValue(event.target.value)} placeholder="Ex.: preço, orçamento, quero agendar" className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }} />
                  </label>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>IQ mínimo</span>
                  <input type="number" value={minIq} onChange={(event) => setMinIq(event.target.value)} placeholder="Sem mínimo" className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }} />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>IE mínimo</span>
                  <input type="number" value={minIe} onChange={(event) => setMinIe(event.target.value)} placeholder="Sem mínimo" className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }} />
                </label>
              </div>
            </div>
          )}

          {node.node_type === "wait" && (
            <div className="grid grid-cols-[1fr_140px] gap-2">
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Tempo de espera</span>
                <input type="number" min="0" value={waitValue} onChange={(event) => setWaitValue(event.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Unidade</span>
                <select value={waitUnit} onChange={(event) => setWaitUnit(event.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                  <option value="seconds">Segundos</option>
                  <option value="minutes">Minutos</option>
                </select>
              </label>
            </div>
          )}

          {node.node_type === "action" && node.config?.action_type !== "move_crm" && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Mensagem</span>
                <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} placeholder="Digite a mensagem que será enviada" className="mt-1 w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }} />
              </label>
              <div className="grid grid-cols-1 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Mídia</span>
                  <select value={mediaType} onChange={(event) => setMediaType(event.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                    <option value="none">Somente texto</option>
                    <option value="image">Imagem</option>
                    <option value="video">Vídeo</option>
                  </select>
                </label>
                {mediaType !== "none" && (
                  <label className="block">
                    <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>URL da mídia</span>
                    <input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://..." className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }} />
                  </label>
                )}
              </div>
              <div className="rounded-2xl p-3" style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.22)" }}>
                <p className="text-xs font-semibold" style={{ color: "#34d399" }}>Preview</p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-title)" }}>{message.trim() ? message : "Mensagem ainda não configurada."}</p>
                {mediaType !== "none" && (
                  <p className="mt-2 break-all text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    {mediaType === "image" ? "Imagem" : "Vídeo"}: {mediaUrl || "URL ainda não informada"}
                  </p>
                )}
              </div>
            </div>
          )}

          {isMoveCrmNode && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Pipeline</span>
                <select value={pipelineId} onChange={(event) => { setPipelineId(event.target.value); setStageId(""); }} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                  <option value="">Selecionar pipeline</option>
                  {resources.pipelines.map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Etapa destino</span>
                <select value={stageId} onChange={(event) => setStageId(event.target.value)} disabled={!pipelineId} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none disabled:opacity-60" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                  <option value="">Selecionar etapa</option>
                  {availableStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {node.node_type === "condition" && (
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Campo</span>
                <select value={conditionField} onChange={(event) => setConditionField(event.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                  <option value="message_body">Texto da mensagem</option>
                  <option value="lead_stage">Etapa do lead</option>
                  <option value="lead_source">Origem do lead</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Operador</span>
                <select value={conditionOperator} onChange={(event) => setConditionOperator(event.target.value)} className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                  <option value="contains">Contém</option>
                  <option value="equals">É igual a</option>
                  <option value="not_empty">Está preenchido</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Valor</span>
                <input value={conditionValue} onChange={(event) => setConditionValue(event.target.value)} placeholder="Valor esperado" className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }} />
              </label>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={!label.trim() || isMutating} className="flex-1 rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: "var(--primary)", color: "#ffffff" }}>{isMutating ? "Salvando..." : "Salvar"}</button>
            <button type="button" onClick={() => onDeleteNode(node.id)} disabled={isMutating} className="rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.22)" }}>Excluir bloco</button>
          </div>
        </form>
      ) : (
        <div className="mt-4 space-y-3">
          <InspectorInput label="Nome do fluxo" value={flow.name} />
          <InspectorSelect label="Status" value={flow.status} />
          <button type="button" onClick={onPublish} className="w-full rounded-full px-3 py-2 text-xs font-semibold" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.22)" }}>Publicar</button>
          <button type="button" onClick={onDeleteFlow} disabled={isMutating} className="w-full rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.22)" }}>Apagar fluxo salvo</button>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2">
        <MetricCard label="Executadas" value={String(metrics.automationsExecuted)} hint="Período" accent="#34d399" />
        <MetricCard label="Falhas" value={String(metrics.failures)} hint="Erros" accent="#ef4444" />
      </div>

      <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--glass-border)" }}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Últimas execuções</h3>
          <button type="button" onClick={onTest} className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.22)" }}>Executar teste</button>
        </div>
        <div className="mt-3 space-y-2">
          {(flow.runs ?? []).length > 0 ? (
            (flow.runs ?? []).slice(0, 4).map((run) => (
              <div key={run.id} className="rounded-xl px-3 py-2" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold" style={{ color: flowRunColor(run.status) }}>{run.status}</span>
                  <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{formatDateTime(run.started_at)}</span>
                </div>
                {run.reason && <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{run.reason}</p>}
              </div>
            ))
          ) : (
            <p className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}>
              Sem execuções recentes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function InspectorInput({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <input value={value} readOnly className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }} />
    </label>
  );
}

function InspectorSelect({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <select value={value} disabled className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none disabled:opacity-100" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
        <option>{value}</option>
      </select>
    </label>
  );
}

function TestFlowModal({
  inbox,
  isMutating,
  onClose,
  onSubmit,
}: {
  inbox: ConversationInboxItem[];
  isMutating: boolean;
  onClose: () => void;
  onSubmit: (threadId: string) => void;
}) {
  const [threadId, setThreadId] = useState(inbox[0]?.thread.id ?? "");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isMutating) return;
    onSubmit(threadId);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }}
      />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        className="lc-modal-panel relative w-full max-w-lg overflow-hidden rounded-2xl p-6 shadow-2xl"
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-[var(--hover)]" aria-label="Fechar">
          <X size={16} style={{ color: "var(--muted-foreground)" }} />
        </button>
        <div className="pr-8">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Testar fluxo</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            Cria um job imediato. Selecione uma conversa para testar ações de envio com destino.
          </p>
        </div>
        <label className="mt-6 block">
          <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Conversa de teste</span>
          <select
            value={threadId}
            onChange={(event) => setThreadId(event.target.value)}
            className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
            style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
          >
            <option value="">Sem conversa vinculada</option>
            {inbox.map((item) => (
              <option key={item.thread.id} value={item.thread.id}>
                {item.contact.name ?? item.contact.phone} · {item.contact.phone}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 rounded-2xl p-3" style={{ background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.22)" }}>
          <p className="text-xs leading-relaxed" style={{ color: "#38bdf8" }}>
            Depois de criar o job, a rota cron de Conversas processa a execução e os logs aparecem no painel do fluxo.
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
            Cancelar
          </button>
          <button type="submit" disabled={isMutating} className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--primary)", color: "#ffffff" }}>
            {isMutating ? "Criando..." : "Criar job de teste"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function AddFlowNodeModal({
  nodeType,
  initialLabel,
  initialConfig,
  isMutating,
  onClose,
  onSubmit,
}: {
  nodeType: ConversationFlowNodeType;
  initialLabel?: string;
  initialConfig?: Record<string, unknown>;
  isMutating: boolean;
  onClose: () => void;
  onSubmit: (input: { nodeType: ConversationFlowNodeType; label: string; config: Record<string, unknown> }) => void;
}) {
  const defaultLabel = nodeType === "condition" ? "Condição" : nodeType === "wait" ? "Esperar" : "Enviar mensagem";
  const [label, setLabel] = useState(initialLabel ?? defaultLabel);
  const [message, setMessage] = useState(typeof initialConfig?.message === "string" ? initialConfig.message : "");
  const [waitValue, setWaitValue] = useState(String(initialConfig?.wait_value ?? initialConfig?.wait_minutes ?? "10"));
  const [waitUnit, setWaitUnit] = useState(typeof initialConfig?.wait_unit === "string" ? initialConfig.wait_unit : "minutes");
  const [conditionField, setConditionField] = useState(typeof initialConfig?.field === "string" ? initialConfig.field : "message_body");
  const [conditionValue, setConditionValue] = useState(typeof initialConfig?.value === "string" ? initialConfig.value : "");
  const actionType = typeof initialConfig?.action_type === "string" ? initialConfig.action_type : "send_message";

  function buildConfig() {
    if (nodeType === "action") {
      return actionType === "move_crm"
        ? { action_type: "move_crm", pipeline_id: "", stage_id: "", assignee: "current", create_note: false }
        : { action_type: "send_message", message };
    }
    if (nodeType === "wait") {
      const value = Number(waitValue) || 0;
      return {
        wait_value: value,
        wait_unit: waitUnit,
        wait_minutes: waitUnit === "seconds" ? value / 60 : value,
      };
    }
    if (nodeType === "condition") {
      return { field: conditionField, operator: "contains", value: conditionValue };
    }
    return {};
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!label.trim() || isMutating) return;
    onSubmit({ nodeType, label, config: buildConfig() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }}
      />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        className="lc-modal-panel relative w-full max-w-lg overflow-hidden rounded-2xl p-6 shadow-2xl"
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-[var(--hover)]" aria-label="Fechar">
          <X size={16} style={{ color: "var(--muted-foreground)" }} />
        </button>
        <div className="pr-8">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Adicionar bloco</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            O bloco será inserido antes do fim do fluxo.
          </p>
        </div>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Nome do bloco</span>
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
            />
          </label>

          {nodeType === "action" && actionType !== "move_crm" && (
            <label className="block">
              <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Mensagem</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Digite a mensagem que será enviada pelo fluxo"
                rows={4}
                className="mt-1 w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
              />
            </label>
          )}

          {nodeType === "action" && actionType === "move_crm" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Pipeline</span>
                <select className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                  <option>Pipeline principal</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Etapa destino</span>
                <select className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                  <option>Selecionar etapa depois</option>
                </select>
              </label>
            </div>
          )}

          {nodeType === "wait" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Tempo de espera</span>
                <input
                  type="number"
                  min="0"
                  value={waitValue}
                  onChange={(event) => setWaitValue(event.target.value)}
                  className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Unidade</span>
                <select
                  value={waitUnit}
                  onChange={(event) => setWaitUnit(event.target.value)}
                  className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
                >
                  <option value="seconds">Segundos</option>
                  <option value="minutes">Minutos</option>
                </select>
              </label>
            </div>
          )}

          {nodeType === "condition" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Campo</span>
                <select
                  value={conditionField}
                  onChange={(event) => setConditionField(event.target.value)}
                  className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
                >
                  <option value="message_body">Texto da mensagem</option>
                  <option value="lead_stage">Etapa do lead</option>
                  <option value="lead_source">Origem do lead</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Contém</span>
                <input
                  value={conditionValue}
                  onChange={(event) => setConditionValue(event.target.value)}
                  placeholder="Valor esperado"
                  className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
                  style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
                />
              </label>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
            Cancelar
          </button>
          <button type="submit" disabled={!label.trim() || isMutating} className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--primary)", color: "#ffffff" }}>
            {isMutating ? "Adicionando..." : "Adicionar bloco"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function NewFlowModal({
  isMutating,
  onClose,
  onSubmit,
}: {
  isMutating: boolean;
  onClose: () => void;
  onSubmit: (input: { name: string; description: string }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || isMutating) return;
    onSubmit({ name, description });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }}
      />
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.96 }}
        className="lc-modal-panel relative w-full max-w-lg overflow-hidden rounded-2xl p-6 shadow-2xl"
      >
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 transition-colors hover:bg-[var(--hover)]" aria-label="Fechar">
          <X size={16} style={{ color: "var(--muted-foreground)" }} />
        </button>
        <div className="pr-8">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Novo fluxo</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
            Crie um rascunho vazio. Os gatilhos, condições e ações serão adicionados no editor visual.
          </p>
        </div>
        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Nome</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Boas-vindas para novos leads"
              className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Descrição</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Resumo rápido do objetivo do fluxo"
              rows={3}
              className="mt-1 w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none"
              style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
            />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
            Cancelar
          </button>
          <button type="submit" disabled={!name.trim() || isMutating} className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--primary)", color: "#ffffff" }}>
            {isMutating ? "Criando..." : "Criar fluxo"}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, compact = false }: {
  icon: React.ElementType;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "px-4 py-8" : "min-h-[360px] px-6 py-10"}`}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}>
        <Icon size={20} />
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>{title}</p>
      <p className="mt-1 max-w-xs text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{description}</p>
    </div>
  );
}

export function ConversasModule() {
  const [activeTab, setActiveTab] = useState<TabId>("conversas");
  const { metrics } = useConversationsDashboard();

  return (
    <div className="space-y-5">
      <TabBar active={activeTab} onChange={setActiveTab} />

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        {activeTab === "conversas" && <ConversasInbox />}
        {activeTab === "contas" && <AccountsTab />}
        {activeTab === "fluxos" && <FlowsTab />}
      </motion.div>

      {activeTab !== "fluxos" && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <MetricCard label="Mensagens enviadas" value={String(metrics.sent)} hint="Manual + automações" accent="#38bdf8" />
            <MetricCard label="Mensagens recebidas" value={String(metrics.received)} hint="Entradas no WhatsApp" accent="#34d399" />
            <MetricCard label="Falhas" value={String(metrics.failures)} hint="Envios ou jobs com erro" accent="#ef4444" />
          </div>

          <div className="lc-card flex items-start gap-3 p-4" style={{ background: "var(--glass-bg-soft)" }}>
            <AlertTriangle size={18} style={{ color: "#d97706" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>MVP interno via QR Code</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                A interface e o schema já estão preparados para WhatsApp Web via worker persistente. A Cloud API oficial fica isolada para um provider futuro.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
