import { Header } from "@/components/layout/Header";
import { KanbanBoard } from "@/components/crm/KanbanBoard";

export default function CrmPage() {
  return (
    <div className="mx-auto max-w-[1600px]">
      <Header title="CRM" subtitle="Funil comercial de leads" />
      <KanbanBoard />
    </div>
  );
}
