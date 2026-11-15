import {validateCalendarEvent,CalendarValidationError} from "@/lib/google-calendar/event-validation";
export function validateLeadReminder(body:Record<string,unknown>,now=Date.now()){
 const minutes=body.noticeMinutes;
 if(typeof minutes!=="number"||!Number.isInteger(minutes)||minutes<0||minutes>40320)throw new CalendarValidationError("Escolha uma antecedência entre 0 minutos e 28 dias.");
 const event=validateCalendarEvent({...body,location:"",reminders:[{method:"popup",minutes}]});
 if(event.title.length>240||event.description.length>4000)throw new CalendarValidationError("Use um título de até 240 caracteres e descrição de até 4.000.");
 if(Date.parse(event.start)<=now)throw new CalendarValidationError("Escolha uma data e hora futuras.");
 const notifyAt=Date.parse(event.start)-minutes*60000;
 if(notifyAt<now-1000)throw new CalendarValidationError("A antecedência colocaria o aviso no passado. Reduza a antecedência ou escolha um horário mais distante.");
 return {...event,noticeMinutes:minutes,notifyAt:new Date(notifyAt).toISOString()};
}
