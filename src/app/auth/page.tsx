"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("reason") === "access_disabled") {
      setError("Seu acesso está desativado ou foi removido. Fale com o administrador.");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const supabase = getSupabaseClient();

    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: profiles, error: profileError } = await supabase
        .from("user_profiles")
        .select("is_active")
        .eq("auth_user_id", authData.user.id);

      const hasProfile = !profileError && (profiles ?? []).length > 0;
      const hasActiveAccess = hasProfile && (profiles ?? []).some((profile) => profile.is_active);
      if (!hasActiveAccess) {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error(hasProfile ? "ACCESS_DISABLED" : "ACCESS_REMOVED");
      }

      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado.";
      if (msg === "Invalid login credentials") setError("E-mail ou senha incorretos.");
      else if (msg.toLowerCase().includes("banned") || msg === "ACCESS_DISABLED") {
        setError("Seu acesso está desativado. Fale com o administrador para reativá-lo.");
      } else if (msg === "ACCESS_REMOVED") {
        setError("Seu acesso a esta plataforma foi removido.");
      } else setError(msg);
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
          <p className="text-sm text-[var(--text-body)]">Entre na sua conta</p>
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
                autoComplete="current-password"
                required
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

          {error && (
            <p className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="lc-btn flex w-full items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-60"
          >
            {isLoading && <Loader2 size={15} className="animate-spin" />}
            Entrar
          </button>
        </form>
      </motion.div>
    </div>
  );
}
