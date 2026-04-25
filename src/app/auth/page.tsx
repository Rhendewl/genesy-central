"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Auth Page — Login + Cadastro
// ─────────────────────────────────────────────────────────────────────────────

type AuthMode = "login" | "register";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    const supabase = getSupabaseClient();

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess("Conta criada! Verifique seu e-mail para confirmar o cadastro.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado.";
      setError(
        msg === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : msg
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% -20%, #142029, transparent)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="lc-glass w-full max-w-sm rounded-3xl p-8"
      >
        {/* Logo / Brand */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <img
            src="/genesy-logo.svg"
            alt="Genesy"
            className="h-8 w-auto select-none"
            draggable={false}
          />
          <p className="text-sm text-[var(--text-body)]">
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[var(--text-body)]">
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="border-[var(--border)] bg-[var(--input)] text-[var(--text-title)] placeholder:text-[var(--muted-foreground)]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[var(--text-body)]">
              Senha
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-[var(--border)] bg-[var(--input)] pr-10 text-[var(--text-title)] placeholder:text-[var(--muted-foreground)]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--text-title)]"
                tabIndex={-1}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error / Success feedback */}
          {error && (
            <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-xl bg-green-500/10 px-4 py-2.5 text-sm text-green-400">
              {success}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="lc-btn flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-60"
          >
            {isLoading && <Loader2 size={15} className="animate-spin" />}
            {mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        {/* Mode toggle */}
        <p className="mt-6 text-center text-sm text-[var(--text-body)]">
          {mode === "login" ? "Não tem conta?" : "Já tem conta?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
              setSuccess(null);
            }}
            className={cn(
              "font-semibold transition-colors hover:underline",
              "text-[var(--primary)]"
            )}
          >
            {mode === "login" ? "Cadastre-se" : "Entrar"}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
