// Layout público do formulário — sem Dock, sem autenticação, sem Header administrativo.
// Não aplica fundo aqui: page.tsx controla o background via tema do formulário.
export default function FormPublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
