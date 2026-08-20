import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatCommercialAnalysisTitle(meetingDate: string) {
  const date = new Date(`${meetingDate}T12:00:00`);
  const month = format(date, "MMMM", { locale: ptBR });
  const weekOfMonth = Math.ceil(date.getDate() / 7);

  return `${month.charAt(0).toUpperCase()}${month.slice(1)} | Semana ${String(weekOfMonth).padStart(2, "0")}`;
}
