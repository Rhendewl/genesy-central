import type { Metadata } from "next";
import { Mail, Clock, User, AtSign, Layout } from "lucide-react";

export const metadata: Metadata = {
  title: "Solicitação de Exclusão de Dados — Genesy Dashboard",
  description:
    "Saiba como solicitar a exclusão dos seus dados pessoais da plataforma Genesy Dashboard.",
};

export default function DataDeletionPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0 opacity-25"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% -20%, #142029, transparent)",
        }}
      />

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo */}
        <div className="mb-10 flex justify-center">
          <img
            src="/genesy-logo.svg"
            alt="Genesy"
            className="h-8 w-auto select-none opacity-90"
            draggable={false}
          />
        </div>

        {/* Card */}
        <div className="lc-glass rounded-3xl p-8 sm:p-10">
          {/* Header */}
          <div className="mb-8 border-b border-[var(--border)] pb-6">
            <h1 className="text-xl font-semibold text-[var(--text-title)]">
              Solicitação de Exclusão de Dados
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-body)]">
              Se você utilizou login ou integração com a plataforma{" "}
              <span className="text-[var(--primary)]">Genesy Dashboard</span> e
              deseja solicitar a exclusão dos seus dados, siga as instruções
              abaixo.
            </p>
          </div>

          {/* How to request */}
          <div className="mb-8 space-y-5">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10">
                <Mail size={15} className="text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-title)]">
                  Envie um e-mail para
                </p>
                <a
                  href="mailto:lancaster@genesycompany.com?subject=Exclusão de Dados"
                  className="mt-0.5 inline-block text-sm font-semibold text-[var(--primary)] underline underline-offset-4 transition-opacity hover:opacity-75"
                >
                  lancaster@genesycompany.com
                </a>
                <p className="mt-0.5 text-xs text-[var(--text-body)]">
                  Assunto:{" "}
                  <span className="font-medium text-[var(--text-title)]">
                    Exclusão de Dados
                  </span>
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--border)]" />

            {/* What to include */}
            <div>
              <p className="mb-3 text-sm font-medium text-[var(--text-title)]">
                Inclua no e-mail
              </p>
              <ul className="space-y-2.5">
                <li className="flex items-start gap-3">
                  <User
                    size={14}
                    className="mt-0.5 shrink-0 text-[var(--text-body)]"
                  />
                  <span className="text-sm text-[var(--text-body)]">
                    Seu{" "}
                    <span className="text-[var(--text-title)]">nome completo</span>
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <AtSign
                    size={14}
                    className="mt-0.5 shrink-0 text-[var(--text-body)]"
                  />
                  <span className="text-sm text-[var(--text-body)]">
                    <span className="text-[var(--text-title)]">E-mail</span> usado
                    no Facebook
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Layout
                    size={14}
                    className="mt-0.5 shrink-0 text-[var(--text-body)]"
                  />
                  <span className="text-sm text-[var(--text-body)]">
                    <span className="text-[var(--text-title)]">
                      Página vinculada
                    </span>{" "}
                    (se houver)
                  </span>
                </li>
              </ul>
            </div>

            {/* Divider */}
            <div className="border-t border-[var(--border)]" />

            {/* Deadline */}
            <div className="flex gap-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10">
                <Clock size={15} className="text-[var(--primary)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-title)]">
                  Prazo de processamento
                </p>
                <p className="mt-0.5 text-sm text-[var(--text-body)]">
                  Sua solicitação será processada em até{" "}
                  <span className="font-semibold text-[var(--text-title)]">
                    7 dias úteis
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>

          {/* CTA button */}
          <a
            href="mailto:lancaster@genesycompany.com?subject=Exclusão de Dados"
            className="lc-btn flex w-full items-center justify-center gap-2 py-2.5 text-sm"
          >
            <Mail size={15} />
            Enviar solicitação por e-mail
          </a>
        </div>

        {/* Footer note */}
        <p className="mt-6 text-center text-xs text-[var(--text-body)]">
          © {new Date().getFullYear()} Genesy Company. Todos os direitos
          reservados.
        </p>
      </div>
    </div>
  );
}
