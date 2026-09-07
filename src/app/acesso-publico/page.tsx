import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Links públicos | Genesy",
  description: "Ambiente seguro para conteúdos compartilhados pela Genesy.",
  robots: { index: false, follow: false },
};

export default function PublicAccessLandingPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#050607] bg-[radial-gradient(circle_at_18%_8%,rgba(176,184,192,.11),transparent_34%),radial-gradient(circle_at_86%_92%,rgba(88,98,104,.09),transparent_32%)] p-6 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[.045] px-7 py-10 text-center shadow-[0_28px_90px_rgba(0,0,0,.48)] backdrop-blur-xl sm:px-10 sm:py-12">
        <img src="/genesy-logoname.svg" alt="Genesy" className="mx-auto h-auto w-28" />
        <p className="mt-8 text-[10px] font-semibold uppercase tracking-[.25em] text-[#9fa9af]">Ambiente de compartilhamento</p>
        <h1 className="mt-4 text-2xl font-semibold leading-tight text-[#f2f3f4] sm:text-3xl">Este endereço é exclusivo para links públicos da Genesy.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-[#8d969c]">Para acessar um portal, formulário, agenda ou diagnóstico, utilize o link completo enviado pela equipe responsável.</p>
        <div className="mx-auto mt-8 h-px w-20 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <p className="mt-7 text-xs text-[#687279]">Nenhum acesso à plataforma está disponível neste endereço.</p>
      </section>
    </main>
  );
}
