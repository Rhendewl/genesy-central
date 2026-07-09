"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Filter,
  GitBranch,
  MessageCircle,
  Phone,
  QrCode,
  Search,
  Send,
  Smartphone,
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
  const { accounts, createAccount, startConnection, disconnectAccount, isMutating } = useConversationsDashboard();
  const [qrAccount, setQrAccount] = useState<ConversationWhatsAppAccount | null>(null);

  async function handleCreateAndConnect() {
    const created = await createAccount();
    if (!created) return;
    const connected = await startConnection(created.id);
    setQrAccount(connected ?? created);
  }

  async function handleStartConnection(account: ConversationWhatsAppAccount) {
    const updated = await startConnection(account.id);
    setQrAccount(updated ?? account);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="Contas conectadas" value={String(accounts.filter((account) => account.status === "connected").length)} hint="Sessões online" accent="#34d399" />
        <MetricCard label="Reconectar" value={String(accounts.filter((account) => account.status === "reconnect" || account.status === "expired").length)} hint="Precisam de QR Code" accent="#d97706" />
        <MetricCard label="Provider ativo" value="QR Code" hint="WhatsApp Web adapter" accent="#38bdf8" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
            <h2 className="font-semibold" style={{ color: "var(--text-title)" }}>Conectar WhatsApp</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
              {isMutating ? "Preparando sessão..." : "Leia o QR Code no WhatsApp Business/App."}
            </p>
          </div>
        </button>

        {accounts.map((account) => (
          <div key={account.id} className="lc-card p-5" style={{ background: "var(--glass-bg-soft)" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold" style={{ color: "var(--text-title)" }}>{account.session_name}</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{account.phone ?? "Telefone pendente"}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${accountStatusColor(account.status)}18`, color: accountStatusColor(account.status) }}>
                {account.status === "connected" ? <Wifi size={20} /> : <WifiOff size={20} />}
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <InfoPill label="Status" value={statusLabels[account.status]} color={accountStatusColor(account.status)} />
              <InfoPill label="Última sincronização" value={account.last_sync_at ? new Date(account.last_sync_at).toLocaleString("pt-BR") : "Nunca"} />
              <InfoPill label="Provider" value="QR Code" />
            </div>
            {account.last_error && (
              <div className="mt-4 rounded-2xl p-3 text-xs" style={{ background: "rgba(217,119,6,0.10)", color: "#d97706", border: "1px solid rgba(217,119,6,0.22)" }}>
                {account.last_error}
              </div>
            )}
            <div className="mt-5 flex gap-2">
              <button onClick={() => void handleStartConnection(account)} disabled={isMutating} className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--primary)", color: "#ffffff" }}>
                {account.status === "connected" ? "Ver status" : "Reconectar"}
              </button>
              <button onClick={() => void disconnectAccount(account.id)} disabled={isMutating} className="rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50" style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>
                Desconectar
              </button>
            </div>
          </div>
        ))}
      </div>

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
        <div className="mx-auto mt-6 grid h-56 w-56 grid-cols-7 gap-1 rounded-2xl p-4" style={{ background: "#ffffff" }}>
          {Array.from({ length: 49 }).map((_, index) => (
            <span key={index} className="rounded-[3px]" style={{ background: index % 2 === 0 || index % 5 === 0 || index % 11 === 0 ? "#111827" : "transparent" }} />
          ))}
        </div>
        <div className="mt-6 rounded-2xl p-4" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Como conectar</p>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            Abra o WhatsApp, acesse Aparelhos conectados e leia o QR Code. Este QR é demonstrativo até o worker persistente ser ativado.
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

function FlowNode({ label, type }: { label: string; type: string }) {
  const color = type === "trigger" ? "#38bdf8" : type === "condition" ? "#d97706" : type === "action" ? "#34d399" : type === "wait" ? "#a78bfa" : "var(--muted-foreground)";
  return (
    <div className="flex items-center gap-3 rounded-2xl p-3" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>{label}</p>
        <p className="text-[11px] uppercase tracking-[0.12em]" style={{ color: "var(--muted-foreground)" }}>{type}</p>
      </div>
    </div>
  );
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
  const { inbox, flows, metrics, isLoading, isMutating, createFlow, updateFlowStatus, testFlow, addFlowNode } = useConversationsDashboard();
  const [selectedId, setSelectedId] = useState(flows[0]?.id ?? "");
  const [showNewFlow, setShowNewFlow] = useState(false);
  const [showTestFlow, setShowTestFlow] = useState(false);
  const [nodeTypeToAdd, setNodeTypeToAdd] = useState<ConversationFlowNodeType | null>(null);
  const selected = flows.find((flow) => flow.id === selectedId) ?? flows[0];

  async function handleCreateFlow(input: {
    name: string;
    description: string;
    triggerType: string;
    scope: "team" | "personal";
  }) {
    const flow = await createFlow(input);
    if (!flow) return;
    setSelectedId(flow.id);
    setShowNewFlow(false);
  }

  async function handleAddNode(input: {
    nodeType: ConversationFlowNodeType;
    label: string;
    config: Record<string, unknown>;
  }) {
    if (!selected) return;
    const node = await addFlowNode(selected.id, input);
    if (!node) return;
    setNodeTypeToAdd(null);
  }

  async function handleStatusChange(status: ConversationFlow["status"]) {
    if (!selected) return;
    const flow = await updateFlowStatus(selected.id, status);
    if (flow) setSelectedId(flow.id);
  }

  async function handleTestFlow(threadId: string) {
    if (!selected) return;
    const ok = await testFlow(selected.id, threadId || null);
    if (ok) setShowTestFlow(false);
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Executadas" value={String(metrics.automationsExecuted)} hint="Fluxos no período" accent="#34d399" />
            <MetricCard label="Canceladas" value={String(metrics.automationsCancelled)} hint="Jobs obsoletos" accent="#d97706" />
          </div>
          <div className="lc-card p-4" style={{ background: "var(--glass-bg-soft)" }}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Fluxos</h2>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Automações visuais de mensagens</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewFlow(true)}
                className="rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: "var(--primary)", color: "#ffffff" }}
              >
                Novo fluxo
              </button>
            </div>
            <div className="space-y-2">
              {isLoading ? (
                <EmptyState icon={GitBranch} title="Carregando fluxos" description="Buscando automações de mensagens..." compact />
              ) : flows.length > 0 ? flows.map((flow) => (
                <button
                  key={flow.id}
                  onClick={() => setSelectedId(flow.id)}
                  className="w-full rounded-2xl p-3 text-left transition-colors hover:bg-[var(--hover)]"
                  style={{ background: selected?.id === flow.id ? "var(--hover)" : "transparent", border: selected?.id === flow.id ? "1px solid var(--glass-border)" : "1px solid transparent" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>{flow.name}</p>
                      <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--muted-foreground)" }}>{flow.description}</p>
                    </div>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: flow.status === "active" ? "rgba(52,211,153,0.12)" : "var(--hover)", color: flow.status === "active" ? "#34d399" : "var(--muted-foreground)" }}>
                      {flow.status}
                    </span>
                  </div>
                </button>
              )) : (
                <EmptyState icon={GitBranch} title="Nenhum fluxo" description="Crie o primeiro fluxo visual de WhatsApp." compact />
              )}
            </div>
          </div>
        </div>

        <div className="lc-card min-h-[620px] overflow-hidden p-5" style={{ background: "var(--glass-bg-soft)" }}>
          {selected ? (
            <div className="grid h-full grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
              <div>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>{selected.name}</h2>
                    <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{selected.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTestFlow(true)}
                      disabled={isMutating}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                      style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.22)" }}
                    >
                      Testar
                    </button>
                    {selected.status === "active" ? (
                      <button
                        type="button"
                        onClick={() => void handleStatusChange("paused")}
                        disabled={isMutating}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        style={{ background: "rgba(217,119,6,0.12)", color: "#d97706", border: "1px solid rgba(217,119,6,0.22)" }}
                      >
                        Pausar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleStatusChange("active")}
                        disabled={isMutating}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.22)" }}
                      >
                        Ativar
                      </button>
                    )}
                    {selected.status !== "archived" && (
                      <button
                        type="button"
                        onClick={() => void handleStatusChange("archived")}
                        disabled={isMutating}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
                        style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
                      >
                        Arquivar
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative space-y-3">
                  {(selected.nodes ?? []).map((node, index, nodes) => (
                    <div key={node.id}>
                      <FlowNode label={node.label} type={node.node_type} />
                      {index < nodes.length - 1 && (
                        <div className="flex h-8 items-center justify-center">
                          <ArrowRight className="rotate-90" size={18} style={{ color: "var(--muted-foreground)" }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl p-4" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Blocos disponíveis</h3>
                <div className="mt-4 space-y-2">
                  {[
                    { label: "Condição", type: "condition" as const },
                    { label: "Espera", type: "wait" as const },
                    { label: "Ação", type: "action" as const },
                  ].map((block) => (
                    <button
                      key={block.type}
                      type="button"
                      onClick={() => setNodeTypeToAdd(block.type)}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--hover)] disabled:opacity-50"
                      disabled={!selected || isMutating}
                      style={{ background: "var(--surface)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
                    >
                      {block.label}
                    </button>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl p-3" style={{ background: "rgba(56,189,248,0.10)", border: "1px solid rgba(56,189,248,0.22)" }}>
                  <p className="text-xs leading-relaxed" style={{ color: "#38bdf8" }}>
                    Editor visual preparado para drag-and-drop. A primeira fase preserva nodes/edges e separa execução em jobs.
                  </p>
                </div>
                <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--glass-border)" }}>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Execuções recentes</h3>
                  <div className="mt-3 space-y-2">
                    {(selected.runs ?? []).length > 0 ? (
                      (selected.runs ?? []).slice(0, 4).map((run) => (
                        <div key={run.id} className="rounded-xl px-3 py-2" style={{ background: "var(--surface)", border: "1px solid var(--glass-border)" }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold" style={{ color: flowRunColor(run.status) }}>{run.status}</span>
                            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{formatDateTime(run.started_at)}</span>
                          </div>
                          {run.reason && (
                            <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{run.reason}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}>
                        Nenhuma execução registrada.
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--glass-border)" }}>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Logs</h3>
                  <div className="mt-3 space-y-2">
                    {(selected.logs ?? []).length > 0 ? (
                      (selected.logs ?? []).slice(0, 5).map((log) => (
                        <div key={log.id} className="rounded-xl px-3 py-2" style={{ background: "var(--surface)", border: "1px solid var(--glass-border)" }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold" style={{ color: flowLogColor(log.level) }}>{log.level}</span>
                            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{formatDateTime(log.created_at)}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs" style={{ color: "var(--text-title)" }}>{log.message}</p>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}>
                        Logs aparecerão após a execução do fluxo.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={GitBranch} title="Nenhum fluxo selecionado" description="Os blocos do fluxo aparecerão aqui quando você criar uma automação." />
          )}
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
        {nodeTypeToAdd && selected && (
          <AddFlowNodeModal
            nodeType={nodeTypeToAdd}
            isMutating={isMutating}
            onClose={() => setNodeTypeToAdd(null)}
            onSubmit={(input) => void handleAddNode(input)}
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
  isMutating,
  onClose,
  onSubmit,
}: {
  nodeType: ConversationFlowNodeType;
  isMutating: boolean;
  onClose: () => void;
  onSubmit: (input: { nodeType: ConversationFlowNodeType; label: string; config: Record<string, unknown> }) => void;
}) {
  const defaultLabel = nodeType === "condition" ? "Condição" : nodeType === "wait" ? "Esperar" : "Enviar mensagem";
  const [label, setLabel] = useState(defaultLabel);
  const [message, setMessage] = useState("");
  const [waitMinutes, setWaitMinutes] = useState("10");
  const [conditionField, setConditionField] = useState("message_body");
  const [conditionValue, setConditionValue] = useState("");

  function buildConfig() {
    if (nodeType === "action") {
      return { action_type: "send_message", message };
    }
    if (nodeType === "wait") {
      return { wait_minutes: Number(waitMinutes) || 0 };
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

          {nodeType === "action" && (
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

          {nodeType === "wait" && (
            <label className="block">
              <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Tempo de espera em minutos</span>
              <input
                type="number"
                min="0"
                value={waitMinutes}
                onChange={(event) => setWaitMinutes(event.target.value)}
                className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
              />
            </label>
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
  onSubmit: (input: { name: string; description: string; triggerType: string; scope: "team" | "personal" }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("manual_start");
  const [scope, setScope] = useState<"team" | "personal">("team");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || isMutating) return;
    onSubmit({ name, description, triggerType, scope });
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
            Crie a automação base com gatilho e fim. Os próximos blocos serão adicionados no editor visual.
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Gatilho</span>
              <select
                value={triggerType}
                onChange={(event) => setTriggerType(event.target.value)}
                className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
              >
                <option value="manual_start">Início manual</option>
                <option value="lead_created">Lead criado</option>
                <option value="message_received">Mensagem recebida</option>
                <option value="stage_changed">Etapa do CRM alterada</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>Escopo</span>
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value as "team" | "personal")}
                className="mt-1 w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
              >
                <option value="team">Equipe</option>
                <option value="personal">Pessoal</option>
              </select>
            </label>
          </div>
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
    </div>
  );
}
