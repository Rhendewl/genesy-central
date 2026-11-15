import {expect,it} from 'vitest';
import {validateLeadReminder} from '../lead-reminder-validation';
const now=Date.parse('2026-11-04T15:00:00Z');
const input={title:'Falar com lead',description:'Retomar proposta',start:'2026-11-04T13:00:00-03:00',end:'2026-11-04T13:15:00-03:00',timezone:'America/Fortaleza',noticeMinutes:10};
it('uses absolute instants and schedules the same reminder lead time in Google and the app',()=>{const r=validateLeadReminder(input,now);expect(r.notifyAt).toBe('2026-11-04T15:50:00.000Z');expect(r.reminders).toEqual([{method:'popup',minutes:10}]);});
it.each([{noticeMinutes:120},{noticeMinutes:-1},{noticeMinutes:1.5},{start:'2026-11-04T14:00:00Z'},{timezone:'invalid'},{end:input.start},{title:'x'.repeat(241)}])('rejects a past notification or invalid event %j',patch=>expect(()=>validateLeadReminder({...input,...patch},now)).toThrow());
