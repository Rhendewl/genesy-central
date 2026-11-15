"use client";

import { forwardRef, useId, useRef, useState, type ChangeEvent, type InputHTMLAttributes } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

export const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const parse = (raw: string) => { const value = raw.length === 7 ? `${raw}-01` : raw; return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(); };

export function DateCalendar({ value, onChange, min, max, onClose, reminder = false, allowedDates, rangeStart, rangeEnd, monthOnly = false }: { value: string; onChange: (value: string) => void; min?: string; max?: string; onClose?: () => void; reminder?: boolean; allowedDates?: string[]; rangeStart?: string; rangeEnd?: string; monthOnly?: boolean }) {
  const [month, setMonth] = useState(() => { const date = parse(value); return new Date(date.getFullYear(), date.getMonth(), 1); });
  const today = monthOnly ? localDate(new Date()).slice(0,7) : localDate(new Date());
  const allowed = (date: string) => (!min || date >= min) && (!max || date <= max) && (!allowedDates || allowedDates.includes(date));
  const pick = (date: string) => { if (allowed(date)) { onChange(date); onClose?.(); } };
  return <div className={`app-date-calendar${reminder ? " app-date-calendar--reminder" : ""}`}>
    <div className="app-date-month"><button type="button" aria-label={monthOnly ? "Ano anterior" : "Mês anterior"} onClick={() => setMonth(date => new Date(date.getFullYear() - (monthOnly ? 1 : 0), date.getMonth() - (monthOnly ? 0 : 1), 1))}><ChevronLeft size={17} /></button><strong aria-live="polite">{monthOnly ? month.getFullYear() : month.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong><button type="button" aria-label={monthOnly ? "Próximo ano" : "Próximo mês"} onClick={() => setMonth(date => new Date(date.getFullYear() + (monthOnly ? 1 : 0), date.getMonth() + (monthOnly ? 0 : 1), 1))}><ChevronRight size={17} /></button></div>
    {monthOnly ? <div className="app-month-grid">{Array.from({length:12},(_,index)=>{const date=new Date(month.getFullYear(),index,1),iso=localDate(date).slice(0,7);return <button type="button" key={iso} aria-label={date.toLocaleDateString("pt-BR",{month:"long",year:"numeric"})} aria-pressed={value===iso} disabled={!allowed(iso)} onClick={()=>pick(iso)}>{date.toLocaleDateString("pt-BR",{month:"short"}).replace(".","")}</button>;})}</div> : <div className="app-date-grid">{["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => <span key={`week-${index}`}>{day}</span>)}{Array.from({ length: month.getDay() }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => { const day = new Date(month.getFullYear(), month.getMonth(), index + 1); const iso = localDate(day); return <button type="button" key={iso} disabled={!allowed(iso)} aria-label={day.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })} aria-pressed={value === iso || rangeStart === iso || rangeEnd === iso} data-in-range={rangeStart && rangeEnd && iso > rangeStart && iso < rangeEnd ? "true" : undefined} aria-current={today === iso ? "date" : undefined} onClick={() => pick(iso)}>{index + 1}</button>; })}</div> }

    <div className="app-date-footer"><span>{reminder ? "Escolha o dia do próximo contato" : "Escolha uma data"}</span><button type="button" disabled={!allowed(today)} onClick={() => pick(today)}>Hoje</button></div>
  </div>;
}

type Props = InputHTMLAttributes<HTMLInputElement> & { popupZIndex?: number };
/** Keeps native form values, required validation and the existing onChange contract. */
export const DateInput = forwardRef<HTMLInputElement, Props>(function DateInput({ type = "date", value, defaultValue, onChange, className, min, max, disabled, readOnly, placeholder = "Selecionar data", style, popupZIndex, ...props }, forwardedRef) {
  const generatedId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [internal, setInternal] = useState(String(defaultValue ?? ""));
  const [open, setOpen] = useState(false);
  const selected = String(value ?? internal);
  const change = (next: string) => {
    setInternal(next);
    const input = inputRef.current;
    if (!input) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, next);
    onChange?.({ target: input, currentTarget: input, type: "change", preventDefault() {}, stopPropagation() {} } as ChangeEvent<HTMLInputElement>);
  };
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <input {...props} id={props.id ? `${props.id}-native` : undefined} ref={node => { inputRef.current = node; if (typeof forwardedRef === "function") forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }} type={type === "month" ? "month" : "date"} value={selected} onChange={onChange} min={min} max={max} disabled={disabled} readOnly={readOnly} className="app-date-native" tabIndex={-1} onInvalid={event => { event.preventDefault(); triggerRef.current?.focus(); setOpen(true); props.onInvalid?.(event); }} />
    <Popover.Trigger ref={triggerRef} id={props.id ?? generatedId} disabled={disabled || readOnly} className={`app-date-trigger ${className ?? "lc-form-control"}`} style={style} aria-label={props["aria-label"] ?? (props.id ? undefined : placeholder)} aria-labelledby={props["aria-labelledby"]} aria-describedby={props["aria-describedby"]} onBlur={() => { if (inputRef.current) props.onBlur?.({ target: inputRef.current, currentTarget: inputRef.current } as React.FocusEvent<HTMLInputElement>); }}><CalendarDays size={16} aria-hidden="true" /><span>{selected ? parse(selected).toLocaleDateString("pt-BR",type === "month" ? {month:"long",year:"numeric"} : undefined) : placeholder}</span></Popover.Trigger>
    <Popover.Portal><Popover.Positioner sideOffset={8} className="app-date-positioner" style={popupZIndex === undefined ? undefined : { zIndex: popupZIndex }}><Popover.Popup className="app-date-popup" aria-label="Escolher data" onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()}><DateCalendar value={selected} monthOnly={type === "month"} min={min ? String(min) : undefined} max={max ? String(max) : undefined} onChange={change} onClose={() => setOpen(false)} />{!props.required && selected && <button type="button" className="app-date-clear" onClick={() => { change(""); setOpen(false); }}>Limpar data</button>}</Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>;
});

export function DateTimeInput({ value, onChange, min, max, className, ...props }: Props) {
  const current = String(value ?? "");
  const change = (next: string) => onChange?.({ target: { value: next, name: props.name ?? "" }, currentTarget: { value: next }, type: "change" } as ChangeEvent<HTMLInputElement>);
  const date = current.slice(0, 10), time = current.slice(11, 16);
  return <div className="app-datetime-input"><DateInput {...props} name={undefined} className={className} value={date} min={min ? String(min).slice(0, 10) : undefined} max={max ? String(max).slice(0, 10) : undefined} onChange={event => change(event.target.value ? `${event.target.value}T${time || "09:00"}` : "")} /><input aria-label="Horário" type="time" required={props.required} disabled={props.disabled} className={className ?? "lc-form-control"} value={time} min={min && date === String(min).slice(0, 10) ? String(min).slice(11, 16) : undefined} max={max && date === String(max).slice(0, 10) ? String(max).slice(11, 16) : undefined} onChange={event => change(`${date || localDate(new Date())}T${event.target.value}`)} />{props.name && <input type="hidden" name={props.name} value={current} />}</div>;
}

export function DateRangeCalendar({ from, to, onApply, onCancel, immediate = false }: { from: Date | null; to: Date | null; onApply: (from: Date, to: Date) => void; onCancel?: () => void; immediate?: boolean }) {
 const [start, setStart] = useState(from ? localDate(from) : "");
 const [end, setEnd] = useState(to ? localDate(to) : "");
 const [pickingEnd, setPickingEnd] = useState(false);
 const choose = (date: string) => {
   if (!pickingEnd) { setStart(date); setEnd(""); setPickingEnd(true); }
   else { const first = date < start ? date : start, last = date < start ? start : date; setStart(first); setEnd(last); setPickingEnd(false); if (immediate) onApply(parse(first), parse(last)); }
 };
 return <div className="app-date-popup app-range-calendar" onMouseDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} role="dialog" aria-label="Selecionar período"><DateCalendar value={start} rangeStart={start} rangeEnd={end} onChange={choose}/><p className="app-range-hint" aria-live="polite">{pickingEnd ? `Início: ${parse(start).toLocaleDateString("pt-BR")} · escolha o fim` : end ? `${parse(start).toLocaleDateString("pt-BR")} a ${parse(end).toLocaleDateString("pt-BR")}` : "Selecione a data inicial"}</p>{!immediate && <div className="app-range-actions"><button type="button" onClick={onCancel}>Cancelar</button><button type="button" disabled={!start || !end || pickingEnd} onClick={() => onApply(parse(start), parse(end))}>Aplicar período</button></div>}</div>;
}
