"use client";
import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays } from "lucide-react";
import { DateRangeCalendar } from "@/components/ui/DateInput";
export function CrmReportRangePicker({from,to,isCustom,onChange}:{from:Date;to:Date;isCustom:boolean;onChange:(from:Date,to:Date)=>void}) {
 const [open,setOpen]=useState(false);
 return <Popover.Root open={open} onOpenChange={setOpen}><Popover.Trigger className="lc-filter-control flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm"><CalendarDays size={16}/><span>{from.toLocaleDateString("pt-BR")} - {to.toLocaleDateString("pt-BR")}</span><span className="text-xs text-[var(--muted-foreground)]">{isCustom?"Personalizado":"Alterar"}</span></Popover.Trigger><Popover.Portal><Popover.Positioner sideOffset={8} className="app-date-positioner"><Popover.Popup><DateRangeCalendar immediate from={from} to={to} onApply={(start,end)=>{onChange(start,end);setOpen(false);}}/></Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root>;
}
