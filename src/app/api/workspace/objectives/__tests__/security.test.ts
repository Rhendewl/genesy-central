// @vitest-environment node
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const {client}=vi.hoisted(()=>({client:{auth:{getUser:vi.fn()},from:vi.fn(),rpc:vi.fn(),storage:{from:vi.fn()}}}));
vi.mock('@/lib/supabase-server',()=>({createServerSupabaseClient:async()=>client}));
import {DELETE,PATCH} from '../[id]/route';
import {POST} from '../route';
const params={params:Promise.resolve({id:'objective'})};
describe('objective API boundaries',()=>{
 beforeEach(()=>{vi.clearAllMocks();client.auth.getUser.mockResolvedValue({data:{user:{id:'member'}}});});
 it('requires authentication before accessing data',async()=>{client.auth.getUser.mockResolvedValue({data:{user:null}});const r=await DELETE(new NextRequest('https://test.local'),params);expect(r.status).toBe(401);expect(client.from).not.toHaveBeenCalled();});
 it('does not remove attachments when assignee cannot delete the objective',async()=>{client.from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:async()=>({data:{user_id:'owner'},error:null})})})});client.rpc.mockResolvedValue({data:false,error:null});const r=await DELETE(new NextRequest('https://test.local'),params);expect(r.status).toBe(403);expect(client.storage.from).not.toHaveBeenCalled();});
 it('rejects malformed creates and updates before querying the database',async()=>{const req=()=>new NextRequest('https://test.local',{method:'POST',body:JSON.stringify({title:'   '})});expect((await POST(req())).status).toBe(400);expect((await PATCH(req(),params)).status).toBe(400);expect(client.from).not.toHaveBeenCalled();});
});
