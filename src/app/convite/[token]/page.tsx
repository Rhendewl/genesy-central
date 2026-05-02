"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle, XCircle, Eye, EyeOff } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";

type InviteInfo = {
  email: string;
  role: string;
  role_label: string;
  full_name: string | null;
};

type PageStatus = "loading" | "valid" | "invalid" | "success";

export default function ConvitePage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();

  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [invalidMessage, setInvalidMessage] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Valida o token ao montar
  useEffect(() => {
    if (!token) return;
    fetch(`/api/invite/validate?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setInvalidMessage(data.error);
          setPageStatus("invalid");
        } else {
          setInvite(data);
          setPageStatus("valid");
        }
      })
      .catch(() => {
        setInvalidMessage("Erro ao verificar o convite. Tente novamente.");
        setPageStatus("invalid");
      });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (password.length < 8) {
      setFormError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setFormError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);

    const res = await fetch("/api/invite/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();

    if (data.error) {
      setFormError(data.error);
      setSubmitting(false);
      return;
    }

    // Faz login automaticamente após criar a conta
    const supabase = getSupabaseClient();
    await supabase.auth.signInWithPassword({
      email: invite!.email,
      password,
    });

    setPageStatus("success");
    setTimeout(() => router.push("/"), 2200);
  }

  // ── Estados de carregamento / inválido / sucesso ───────────────────────────

  if (pageStatus === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 size={28} className="animate-spin" style={{ color: "rgba(255,255,255,0.25)" }} />
      </div>
    );
  }

  if (pageStatus === "invalid") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{
            background: "rgba(10,10,10,0.9)",
            border: "1px solid rgba(248,113,113,0.2)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "rgba(248,113,113,0.1)" }}
          >
            <XCircle size={26} style={{ color: "#f87171" }} />
          </div>
          <h2 className="text-[18px] font-bold" style={{ color: "#fff" }}>
            Convite inválido
          </h2>
          <p className="mt-2 text-[13px]" style={{ color: "rgba(255,255,255,0.45)" }}>
            {invalidMessage}
          </p>
          <button
            onClick={() => router.push("/auth")}
            className="mt-6 w-full rounded-xl py-2.5 text-[13px] font-medium transition-colors"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.13)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
          >
            Ir para o login
          </button>
        </motion.div>
      </div>
    );
  }

  if (pageStatus === "success") {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm rounded-2xl p-8 text-center"
          style={{
            background: "rgba(10,10,10,0.9)",
            border: "1px solid rgba(52,211,153,0.2)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "rgba(52,211,153,0.1)" }}
          >
            <CheckCircle size={26} style={{ color: "#34d399" }} />
          </div>
          <h2 className="text-[18px] font-bold" style={{ color: "#fff" }}>
            Conta criada!
          </h2>
          <p className="mt-2 text-[13px]" style={{ color: "rgba(255,255,255,0.45)" }}>
            Entrando na plataforma…
          </p>
          <Loader2 size={18} className="mx-auto mt-5 animate-spin" style={{ color: "rgba(52,211,153,0.6)" }} />
        </motion.div>
      </div>
    );
  }

  // ── Formulário de criação de senha ─────────────────────────────────────────

  const inputStyle = {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#ffffff",
  };

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <span
            className="text-[22px] font-extrabold tracking-tight"
            style={{ color: "#fff", letterSpacing: "-0.04em" }}
          >
            Lancaster
          </span>
        </div>

        <div
          className="rounded-2xl p-7"
          style={{
            background: "rgba(10,10,10,0.9)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}
        >
          {/* Topo do card */}
          <div className="mb-6">
            <h2
              className="text-[18px] font-bold"
              style={{ color: "#fff", letterSpacing: "-0.02em" }}
            >
              Criar sua senha
            </h2>
            <p className="mt-1 text-[13px]" style={{ color: "rgba(255,255,255,0.4)" }}>
              Você foi convidado como{" "}
              <span style={{ color: "#27a3ff", fontWeight: 600 }}>{invite?.role_label}</span>
            </p>
          </div>

          {/* E-mail (readonly) */}
          <div className="mb-4 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
              Entrando como
            </p>
            <p className="mt-0.5 text-[13px] font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
              {invite?.email}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Senha */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                Senha
              </label>
              <div className="relative">
                <input
                  required
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="h-10 w-full rounded-xl px-3.5 pr-10 text-[14px] outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(39,163,255,0.5)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirmar senha */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)" }}>
                Confirmar senha
              </label>
              <div className="relative">
                <input
                  required
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repita a senha"
                  className="h-10 w-full rounded-xl px-3.5 pr-10 text-[14px] outline-none transition-all"
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(39,163,255,0.5)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {formError && (
              <p
                className="rounded-xl px-3.5 py-2.5 text-[12px]"
                style={{ background: "rgba(248,113,113,0.1)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}
              >
                {formError}
              </p>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={submitting || !password || !confirm}
              className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold transition-all disabled:opacity-50"
              style={{ background: "#27a3ff", color: "#000" }}
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {submitting ? "Criando conta…" : "Criar conta e entrar"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
