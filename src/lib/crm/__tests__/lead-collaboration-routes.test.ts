import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const h=vi.hoisted(()=>({server:vi.fn(),admin:vi.fn(),google:vi.fn(),token:vi.fn()}));
vi.mock('@/lib/supabase-server',()=>({createServerSupabaseClient:h.server}));
vi.mock('@/lib/supabase-admin',()=>({createAdminSupabaseClient:h.admin}));
vi.mock('@/lib/google-calendar/google-token-service',()=>({GoogleTokenService:class{getValidAccessToken=h.token;}}));
vi.mock('@/lib/google-calendar/google-calendar-service',()=>({createCalendarEvent:h.google,GoogleAuthError:class extends Error{}}));
import {POST as notePOST} from '@/app/api/crm/leads/[id]/notes/route';
import {POST as reminderPOST} from '@/app/api/crm/leads/[id]/reminders/route';
const leadId='11111111-1111-4111-8111-111111111111',attempt='22222222-2222-4222-8222-222222222222';
function database(results:unknown[]){const calls:{table:string;op:string;value?:any;filters:any[]}[]=[];return{calls,from:vi.fn((table:string)=>{const call={table,op:'select',value:undefined as any,filters:[] as any[]};calls.push(call);const q:any={then:(resolve:any,reject:any)=>Promise.resolve(results.shift()).then(resolve,reject)};for(const key of ['select','insert','update','eq','in','or','order','limit','maybeSingle','single'])q[key]=(...args:any[])=>{if(key==='insert'||key==='update'){call.op=key;call.value=args[0];}if(key==='eq'||key==='in'||key==='or')call.filters.push([key,...args]);return q;};return q;})};}
function authenticated(){const db=database([{data:{id:leadId,user_id:'owner',name:'Lead'}},{data:{id:'profile',full_name:'Autor real',avatar_url:'https://example.com/avatar.jpg'}}]);h.server.mockResolvedValue({...db,auth:{getUser:async()=>({data:{user:{id:'auth'}}})}});return db;}
const request=(path:string,body:unknown)=>new NextRequest(`https://example.com/api/crm/leads/${leadId}/${path}`,{method:'POST',body:JSON.stringify(body)});
const context={params:Promise.resolve({id:leadId})};
beforeEach(()=>{vi.clearAllMocks();});
it('denies an unauthenticated note before accessing admin data',async()=>{h.server.mockResolvedValue({auth:{getUser:async()=>({data:{user:null}})}});const r=await notePOST(request('notes',{id:attempt,body:'text'}),context);expect(r.status).toBe(401);expect(h.admin).not.toHaveBeenCalled();});
it('denies an inaccessible lead before writing any note',async()=>{const db=database([{data:null}]);h.server.mockResolvedValue({...db,auth:{getUser:async()=>({data:{user:{id:'auth'}}})}});const r=await notePOST(request('notes',{id:attempt,body:'text'}),context);expect(r.status).toBe(404);expect(h.admin).not.toHaveBeenCalled();});
it('records identity from the authenticated profile, ignores forged identity and leaves time to the database',async()=>{
 authenticated();const admin=database([{data:{id:attempt,body:'text'}}]);h.admin.mockReturnValue(admin);
 const r=await notePOST(request('notes',{id:attempt,body:' text ',author_name:'FORGED',author_auth_id:'other',created_at:'1900-01-01'}),context);expect(r.status).toBe(201);
 expect(admin.calls[0].value).toMatchObject({body:'text',author_name:'Autor real',author_auth_id:'auth',author_profile_id:'profile',lead_id:leadId,owner_id:'owner'});expect(admin.calls[0].value.created_at).toBeUndefined();
});
it('recovers the same note on retry but rejects an attempt reused for different text',async()=>{
 authenticated();const admin=database([{error:{code:'23505'}},{data:{id:attempt,body:'same'}}]);h.admin.mockReturnValue(admin);expect((await notePOST(request('notes',{id:attempt,body:'same'}),context)).status).toBe(200);
 authenticated();const other=database([{error:{code:'23505'}},{data:{id:attempt,body:'different'}}]);h.admin.mockReturnValue(other);expect((await notePOST(request('notes',{id:attempt,body:'same'}),context)).status).toBe(409);expect(other.calls[1].filters).toContainEqual(['eq','author_auth_id','auth']);
});
it('reserves a reminder, creates a private deterministic event and confirms before returning success',async()=>{
 authenticated();const admin=database([{data:null},{error:null},{data:{id:attempt}},{data:{id:attempt,status:'scheduled'}}]);h.admin.mockReturnValue(admin);h.token.mockResolvedValue('test-token');h.google.mockResolvedValue({id:'google-event',htmlLink:'https://calendar.google.com/event'});
 const start=new Date(Date.now()+3600000).toISOString(),end=new Date(Date.now()+4500000).toISOString();const r=await reminderPOST(request('reminders',{id:attempt,title:'Falar com lead',description:'Contexto',start,end,timezone:'America/Fortaleza',noticeMinutes:10}),context);
 expect(r.status).toBe(201);expect(admin.calls[1].value).toMatchObject({creator_auth_id:'auth',recipient_profile_id:'profile',notice_minutes:10});
 expect(h.google.mock.calls[0][0]).toMatchObject({googleCalendarId:'primary',reminderId:attempt,reminders:[{method:'popup',minutes:10}]});expect(h.google.mock.calls[0][0].eventId).toMatch(/^[0-9a-f]{64}$/);expect(h.google.mock.calls[0][0].attendeeEmail).toBeUndefined();expect(admin.calls[3].value.status).toBe('scheduled');
});
it('keeps a failed Google creation retryable without claiming success or scheduling an in-app alert',async()=>{
 authenticated();const admin=database([{data:null},{error:null},{data:{id:attempt}},{error:null}]);h.admin.mockReturnValue(admin);h.token.mockResolvedValue('test-token');h.google.mockRejectedValue(Error('network'));
 const r=await reminderPOST(request('reminders',{id:attempt,title:'Contato',start:new Date(Date.now()+3600000).toISOString(),end:new Date(Date.now()+4500000).toISOString(),timezone:'America/Fortaleza',noticeMinutes:10}),context);expect(r.status).toBe(502);expect(admin.calls[3].value).toMatchObject({status:'google_error',locked_until:null});
});
it('refuses concurrent reminder creation while another request holds the reservation',async()=>{
 authenticated();const admin=database([{data:null},{error:null},{data:null}]);h.admin.mockReturnValue(admin);const r=await reminderPOST(request('reminders',{id:attempt,title:'Contato',start:new Date(Date.now()+3600000).toISOString(),end:new Date(Date.now()+4500000).toISOString(),timezone:'America/Fortaleza',noticeMinutes:10}),context);expect(r.status).toBe(409);expect(h.google).not.toHaveBeenCalled();
});
