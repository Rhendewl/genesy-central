// Layout público de agendamento — sem Dock, sem sidebar, sem background de admin.
// AuthLayout exclui /agendar/* das suas condições de showDock e background.
export default function AgendarPublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
