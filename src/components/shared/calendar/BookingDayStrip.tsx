"use client";

import { DateCalendar } from "@/components/ui/DateInput";

export interface BookingDayStripProps {
  visibleDays:  string[];
  selectedDate: string | null;
  today:        string;
  color:        string;
  cardBg:       string;
  borderC:      string;
  textColor:    string;
  muted:        string;
  onSelectDate: (dateStr: string) => void;
}

export function BookingDayStrip({visibleDays,selectedDate,muted,onSelectDate}:BookingDayStripProps) {
 if (!visibleDays.length) return <p className="py-4 text-center text-xs" style={{color:muted}}>Nenhum horário disponível nos próximos dias.</p>;
 return <div className="app-date-popup" style={{width:"100%",maxWidth:390}}><DateCalendar key={visibleDays[0]} value={selectedDate ?? visibleDays[0]} allowedDates={visibleDays} min={visibleDays[0]} max={visibleDays[visibleDays.length-1]} onChange={onSelectDate}/></div>;
}
