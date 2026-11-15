"use client";
import { DateInput } from "@/components/ui/DateInput";
export function DatePickerPopover({value,onChange,placeholder="Selecionar data",className}:{value:string|null;onChange:(value:string|null)=>void;placeholder?:string;className?:string}) {
 return <DateInput value={value ?? ""} onChange={event=>onChange(event.target.value || null)} placeholder={placeholder} className={`lc-filter-control w-full rounded-xl px-3 py-2 text-sm ${className ?? ""}`} />;
}
