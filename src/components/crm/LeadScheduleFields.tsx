"use client";
import {useEffect,useRef,useState} from "react";
import {Popover} from "@base-ui/react/popover";
import {CalendarDays,Clock} from "lucide-react";
import {DateCalendar} from "@/components/ui/DateInput";
const pad=(n:number)=>String(n).padStart(2,"0");
export function LeadScheduleFields({value,onChange,disabled}:{value:string;onChange:(value:string)=>void;disabled:boolean}){
 const date=value.slice(0,10),time=value.slice(11,16),[dateOpen,setDateOpen]=useState(false),[timeOpen,setTimeOpen]=useState(false);
 const hourRef=useRef<HTMLButtonElement>(null),minuteRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!timeOpen)return;const frame=requestAnimationFrame(()=>{hourRef.current?.scrollIntoView?.({block:"center"});minuteRef.current?.scrollIntoView?.({block:"center"});});return()=>cancelAnimationFrame(frame);},[timeOpen,time]);
 const initial=new Date(`${date}T12:00:00`);
 const changeTime=(part:"hour"|"minute",n:number)=>{const [h,m]=time.split(":");onChange(`${date}T${part==="hour"?pad(n):h||"09"}:${part==="minute"?pad(n):m||"00"}`);};
 return <div className="lead-schedule-fields">
  <div><span id="lead-reminder-date-label">Data do contato</span><Popover.Root open={dateOpen} onOpenChange={setDateOpen}><Popover.Trigger disabled={disabled} className="lead-schedule-trigger" aria-labelledby="lead-reminder-date-label lead-reminder-date-value"><CalendarDays size={17}/><span id="lead-reminder-date-value">{initial.toLocaleDateString("pt-BR")}</span></Popover.Trigger><Popover.Portal><Popover.Positioner sideOffset={8} className="lead-schedule-positioner"><Popover.Popup className="lead-date-popover lc-modal-panel app-reminder-date-popup" aria-label="Escolher data do lembrete">
   <DateCalendar reminder value={date} onChange={next=>onChange(`${next}T${time||"09:00"}`)} onClose={()=>setDateOpen(false)}/>
  </Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root></div>
  <div><span id="lead-reminder-time-label">Horário</span><Popover.Root open={timeOpen} onOpenChange={setTimeOpen}><Popover.Trigger disabled={disabled} className="lead-schedule-trigger" aria-labelledby="lead-reminder-time-label lead-reminder-time-value"><Clock size={17}/><span id="lead-reminder-time-value">{time}</span></Popover.Trigger><Popover.Portal><Popover.Positioner sideOffset={8} className="lead-schedule-positioner"><Popover.Popup className="lead-time-popover lc-modal-panel" aria-label="Escolher horário do lembrete"><div className="lead-time-heading"><strong>Hora</strong><strong>Minuto</strong></div><div className="lead-time-lists">{(["hour","minute"] as const).map(part=><div key={part} role="group" aria-label={part==="hour"?"Hora":"Minuto"}>{Array.from({length:part==="hour"?24:60},(_,n)=><button type="button" key={n} ref={Number(time.split(":")[part==="hour"?0:1])===n?(part==="hour"?hourRef:minuteRef):undefined} aria-label={`${part==="hour"?"Hora":"Minuto"} ${pad(n)}`} aria-pressed={Number(time.split(":")[part==="hour"?0:1])===n} onClick={()=>changeTime(part,n)}>{pad(n)}</button>)}</div>)}</div><div className="lead-time-footer"><strong>{time}</strong><button type="button" onClick={()=>setTimeOpen(false)}>Confirmar horário</button></div></Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root></div>
 </div>;
}
