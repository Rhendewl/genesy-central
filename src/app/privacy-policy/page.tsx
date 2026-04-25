import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidade — Genesy Dashboard",
  description:
    "Entenda como o Genesy Dashboard coleta, usa e protege seus dados pessoais conforme a LGPD.",
};

const LAST_UPDATED = "25 de abril de 2025";
const CONTACT_EMAIL = "lancaster@genesycompany.com";

// ── Section component ─────────────────────────────────────────────────────────

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-[var(--text-title)]">
        <span className="shrink-0 tabular-nums text-[var(--primary)]">{number}.</span>
        {title}
      </h2>
      <div className="space-y-2 text-sm leading-relaxed text-[var(--text-body)]">
        {children}
      </div>
    </section>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]/60" />
      <span>{children}</span>
    </li>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PrivacyPolicyPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center px-4 py-16">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0 opacity-25"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% -20%, #142029, transparent)",
        }}
      />

      <div className="relative z-10 w-full max-w-2xl">
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
            <h1 className="text-2xl font-bold text-[var(--text-title)]">
              Política de Privacidade
            </h1>
            <p className="mt-1 text-sm text-[var(--text-body)]">
              Última atualização:{" "}
              <span className="text-[var(--text-title)]">{LAST_UPDATED}</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-body)]">
              Esta Política de Privacidade descreve como o{" "}
              <span className="font-medium text-[var(--text-title)]">
                Genesy Dashboard
              </span>{" "}
              ("plataforma", "nós") coleta, utiliza, armazena e protege as
              informações dos usuários que acessam nossos serviços, em
              conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei
              13.709/2018).
            </p>
          </div>

          {/* Sections */}
          <div className="space-y-8">
            {/* 1 */}
            <Section number="1" title="Dados que coletamos">
              <p>
                Ao utilizar a plataforma, podemos coletar as seguintes
                informações:
              </p>
              <ul className="mt-2 space-y-1.5">
                <Li>
                  <strong className="text-[var(--text-title)]">Dados de conta:</strong>{" "}
                  nome e endereço de e-mail fornecidos no cadastro.
                </Li>
                <Li>
                  <strong className="text-[var(--text-title)]">Dados de leads:</strong>{" "}
                  nome, telefone, e-mail e informações de contato recebidos via
                  integrações com anúncios (Meta Lead Ads).
                </Li>
                <Li>
                  <strong className="text-[var(--text-title)]">Dados de integração:</strong>{" "}
                  tokens de acesso e identificadores de páginas autorizados pelo
                  próprio usuário ao conectar sua conta Meta/Facebook.
                </Li>
                <Li>
                  <strong className="text-[var(--text-title)]">Dados operacionais:</strong>{" "}
                  informações financeiras, métricas de tráfego e registros de
                  movimentação inseridos manualmente pelo usuário no CRM.
                </Li>
                <Li>
                  <strong className="text-[var(--text-title)]">Dados técnicos:</strong>{" "}
                  endereço IP, tipo de navegador e logs de acesso para segurança
                  e diagnóstico.
                </Li>
              </ul>
            </Section>

            {/* 2 */}
            <Section number="2" title="Como usamos os dados">
              <p>Os dados coletados são utilizados exclusivamente para:</p>
              <ul className="mt-2 space-y-1.5">
                <Li>Autenticar e manter a segurança da sua conta.</Li>
                <Li>
                  Processar e exibir leads recebidos via integração Meta Lead
                  Ads no CRM.
                </Li>
                <Li>
                  Gerar métricas, relatórios e visualizações financeiras e de
                  tráfego.
                </Li>
                <Li>
                  Enviar notificações operacionais relacionadas ao uso da
                  plataforma.
                </Li>
                <Li>
                  Melhorar a experiência e corrigir falhas técnicas da
                  plataforma.
                </Li>
              </ul>
              <p className="mt-2">
                Não utilizamos seus dados para fins publicitários ou vendemos
                informações a terceiros.
              </p>
            </Section>

            {/* 3 */}
            <Section number="3" title="Compartilhamento com provedores">
              <p>
                Para operar a plataforma, utilizamos os seguintes provedores
                de serviço, que atuam como operadores de dados sob contrato:
              </p>
              <ul className="mt-2 space-y-1.5">
                <Li>
                  <strong className="text-[var(--text-title)]">Supabase:</strong>{" "}
                  banco de dados e autenticação (armazenamento seguro de todos
                  os dados da plataforma).
                </Li>
                <Li>
                  <strong className="text-[var(--text-title)]">Vercel:</strong>{" "}
                  hospedagem e entrega da aplicação web.
                </Li>
                <Li>
                  <strong className="text-[var(--text-title)]">Meta (Facebook):</strong>{" "}
                  integração com Lead Ads autorizada diretamente pelo usuário.
                  Os dados de leads são recebidos via webhook após consentimento
                  explícito do titular.
                </Li>
              </ul>
              <p className="mt-2">
                Esses provedores possuem suas próprias políticas de privacidade e
                estão sujeitos às legislações aplicáveis de proteção de dados.
              </p>
            </Section>

            {/* 4 */}
            <Section number="4" title="Segurança dos dados">
              <p>
                Adotamos medidas técnicas e organizacionais para proteger suas
                informações:
              </p>
              <ul className="mt-2 space-y-1.5">
                <Li>
                  Tokens de acesso armazenados com criptografia AES-256-GCM.
                </Li>
                <Li>
                  Comunicação protegida por TLS/HTTPS em todos os pontos da
                  plataforma.
                </Li>
                <Li>
                  Controle de acesso por autenticação segura (Supabase Auth).
                </Li>
                <Li>
                  Validação de assinatura HMAC-SHA256 nos eventos recebidos via
                  webhook Meta.
                </Li>
                <Li>
                  Isolamento de dados por usuário com políticas de Row-Level
                  Security (RLS) no banco de dados.
                </Li>
              </ul>
              <p className="mt-2">
                Apesar dessas medidas, nenhum sistema é 100% invulnerável.
                Recomendamos que você mantenha suas credenciais de acesso em
                segurança.
              </p>
            </Section>

            {/* 5 */}
            <Section number="5" title="Retenção de dados">
              <p>
                Os dados são retidos enquanto a conta do usuário estiver ativa.
                Ao solicitar a exclusão da conta, todos os dados pessoais
                associados serão permanentemente removidos em até{" "}
                <strong className="text-[var(--text-title)]">7 dias úteis</strong>.
              </p>
              <p className="mt-2">
                Logs técnicos podem ser retidos por até 90 dias para fins de
                segurança e diagnóstico, após o que são automaticamente
                descartados.
              </p>
            </Section>

            {/* 6 */}
            <Section number="6" title="Direitos do usuário">
              <p>
                Nos termos da LGPD, você tem o direito de:
              </p>
              <ul className="mt-2 space-y-1.5">
                <Li>Confirmar a existência de tratamento dos seus dados.</Li>
                <Li>Acessar os dados que temos sobre você.</Li>
                <Li>Corrigir dados incompletos, inexatos ou desatualizados.</Li>
                <Li>
                  Solicitar a exclusão de dados tratados com base em
                  consentimento.
                </Li>
                <Li>
                  Revogar consentimento de integrações (ex.: desconectar a conta
                  Meta) a qualquer momento.
                </Li>
                <Li>
                  Solicitar portabilidade dos seus dados em formato estruturado.
                </Li>
              </ul>
            </Section>

            {/* 7 */}
            <Section number="7" title="Solicitação de exclusão de dados">
              <p>
                Para solicitar a exclusão completa dos seus dados, envie um
                e-mail para{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=Exclusão de Dados`}
                  className="font-medium text-[var(--primary)] underline underline-offset-4 transition-opacity hover:opacity-75"
                >
                  {CONTACT_EMAIL}
                </a>{" "}
                com o assunto{" "}
                <strong className="text-[var(--text-title)]">
                  "Exclusão de Dados"
                </strong>
                , informando:
              </p>
              <ul className="mt-2 space-y-1.5">
                <Li>Nome completo.</Li>
                <Li>E-mail utilizado na plataforma ou no Facebook.</Li>
                <Li>Página vinculada, se houver.</Li>
              </ul>
              <p className="mt-2">
                Você também pode acessar nossa{" "}
                <a
                  href="/data-deletion"
                  className="font-medium text-[var(--primary)] underline underline-offset-4 transition-opacity hover:opacity-75"
                >
                  página de exclusão de dados
                </a>{" "}
                para mais detalhes.
              </p>
            </Section>

            {/* 8 */}
            <Section number="8" title="Cookies e rastreamento">
              <p>
                Utilizamos cookies estritamente necessários para manter sua
                sessão autenticada. Não utilizamos cookies de rastreamento,
                analytics de terceiros ou publicidade comportamental.
              </p>
            </Section>

            {/* 9 */}
            <Section number="9" title="Alterações nesta política">
              <p>
                Podemos atualizar esta política periodicamente. A data da última
                atualização é sempre exibida no topo desta página. Alterações
                significativas serão comunicadas por e-mail ou por aviso na
                plataforma.
              </p>
            </Section>

            {/* 10 */}
            <Section number="10" title="Contato">
              <p>
                Para dúvidas, solicitações ou exercício dos seus direitos como
                titular de dados, entre em contato:
              </p>
              <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--input)] px-5 py-4">
                <p className="text-sm font-medium text-[var(--text-title)]">
                  Genesy Company
                </p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="mt-0.5 inline-block text-sm text-[var(--primary)] underline underline-offset-4 transition-opacity hover:opacity-75"
                >
                  {CONTACT_EMAIL}
                </a>
              </div>
            </Section>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-[var(--text-body)]">
          © {new Date().getFullYear()} Genesy Company. Todos os direitos
          reservados.
        </p>
      </div>
    </div>
  );
}
