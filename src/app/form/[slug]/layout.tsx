// Layout público do formulário — sem Dock, sem autenticação, sem Header administrativo.
export default function FormPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {children}
    </div>
  );
}
