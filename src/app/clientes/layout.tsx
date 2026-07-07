export default function ClientesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="module-shell-bg"
      style={{
        margin:               12,
        minHeight:            "calc(100dvh - 24px)",
        borderRadius:         20,
        overflow:             "hidden",
        background: "rgba(10,10,10,.10)",
        backdropFilter:       "blur(24px) saturate(160%)",
        WebkitBackdropFilter: "blur(24px) saturate(160%)",
        border: "1px solid var(--glass-border)",
        boxShadow:            "0 12px 40px rgba(0,0,0,.18)",
      }}
    >
      {children}
    </div>
  );
}
