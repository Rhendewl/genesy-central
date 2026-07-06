import { WorkspaceSubNav } from "@/components/workspace/WorkspaceSubNav";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        margin:       12,
        borderRadius: 20,
        overflow:     "hidden",
        background:   "rgba(10,10,10,.10)",
        border:       "1px solid rgba(255,255,255,.06)",
        boxShadow:    "0 12px 40px rgba(0,0,0,.18)",
      }}
    >
      <WorkspaceSubNav />
      {children}
    </div>
  );
}
