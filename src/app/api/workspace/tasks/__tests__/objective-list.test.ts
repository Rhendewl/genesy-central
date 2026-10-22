// @vitest-environment node
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const {client,eq,admin}=vi.hoisted(()=>({client:{auth:{getUser:vi.fn()},from:vi.fn()},eq:vi.fn(),admin:vi.fn()}));
vi.mock('@/lib/supabase-server',()=>({createServerSupabaseClient:async()=>client}));
vi.mock('@/lib/workspace/task-authorization',()=>({isWorkspaceAdminOfUser:admin}));
vi.mock('@/lib/event-bus/platform',()=>({getPlatformEventBus:vi.fn()}));
import {GET} from '../route';
const objective='00000000-0000-4000-8000-000000000001';
const request=()=>new NextRequest(`https://test.local/api/workspace/tasks?objective_id=${objective}&objective_only=1`);
describe('objective task list',()=>{
 beforeEach(()=>{vi.clearAllMocks();client.auth.getUser.mockResolvedValue({data:{user:{id:'self'}}});client.from.mockReturnValue({select:()=>({eq})});admin.mockResolvedValue(false);});
 it('requires authentication',async()=>{client.auth.getUser.mockResolvedValue({data:{user:null}});expect((await GET(request())).status).toBe(401);expect(client.from).not.toHaveBeenCalled();});
 it('queries only objective links and preserves assignees and edit permission',async()=>{eq.mockResolvedValue({data:[{id:'link',task_id:'task',task:{id:'task',created_by:'other',user_id:'owner',workspace_task_assignees:[{assignee_id:'member'}]}}],error:null});const r=await GET(request());const data=await r.json();expect(client.from).toHaveBeenCalledTimes(1);expect(client.from).toHaveBeenCalledWith('workspace_objective_task_links');expect(eq).toHaveBeenCalledWith('objective_id',objective);expect(data.tasks[0].assignee_ids).toEqual(['member']);expect(data.tasks[0].can_edit).toBe(false);expect(data.objective_links).toEqual([{id:'link',task_id:'task'}]);});
 it('does not expose tasks hidden by RLS or scan other tasks when empty',async()=>{eq.mockResolvedValue({data:[{id:'link',task_id:'hidden',task:null}],error:null});const data=await(await GET(request())).json();expect(data.tasks).toEqual([]);expect(client.from).toHaveBeenCalledTimes(1);expect(admin).not.toHaveBeenCalled();});
 it('keeps errors explicit instead of presenting empty success',async()=>{eq.mockResolvedValue({data:null,error:{message:'Connection failed'}});expect((await GET(request())).status).toBe(500);});
});
