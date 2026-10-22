import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,createElement} from 'react';
import {createRoot,Root} from 'react-dom/client';
const {createTask,upsert,onSaved}=vi.hoisted(()=>({createTask:vi.fn(),upsert:vi.fn(),onSaved:vi.fn()}));
vi.mock('@/hooks/useModalOpen',()=>({useModalOpen:()=>{}}));
vi.mock('@/context/WorkspaceViewingContext',()=>({useWorkspaceViewing:()=>({viewingMember:null})}));
vi.mock('@/hooks/useWorkspaceTasks',()=>({useWorkspaceTasks:()=>({createTask,tasks:[{id:'existing',title:'Existing task'}],isLoading:false,error:null})}));
vi.mock('@/lib/supabase',()=>({getSupabaseClient:()=>({from:()=>({upsert})})}));
vi.mock('@/components/workspace/AssigneePicker',()=>({AssigneePicker:()=>null}));
vi.mock('@/components/tags/TagSelector',()=>({TagSelector:()=>null}));
vi.mock('../TaskDestinationPicker',()=>({TaskDestinationPicker:({onChange}:{onChange:(id:string)=>void})=>createElement('button',{type:'button',onClick:()=>onChange('chosen-board')},'Choose board')}));
import {BscTaskModal} from '../BscTaskModal';
let root:Root;
beforeEach(async()=>{vi.clearAllMocks();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);root=createRoot(document.createElement('div'));createTask.mockResolvedValue({task:{id:'new-task'},error:null});upsert.mockResolvedValue({error:null});await act(async()=>root.render(createElement(BscTaskModal,{objectiveId:'objective',linkedIds:[],onClose:()=>{},onSaved})));});
afterEach(async()=>{await act(async()=>root.unmount());vi.unstubAllGlobals();});
async function click(text:string){await act(async()=>{Array.from(document.querySelectorAll('button')).find(b=>b.textContent===text)!.click();});}
async function submit(){await act(async()=>{document.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});}
async function prepare(){const input=document.querySelector('input')!;await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'New task');input.dispatchEvent(new Event('input',{bubbles:true}));});await click('Choose board');}
it('creates the task in the selected workspace and links it to the objective',async()=>{await prepare();await submit();expect(createTask).toHaveBeenCalledWith(expect.objectContaining({title:'New task',board_id:'chosen-board'}));expect(upsert).toHaveBeenCalledWith({objective_id:'objective',task_id:'new-task'},expect.anything());expect(onSaved).toHaveBeenCalledOnce();});
it('retries a failed link without creating the task twice',async()=>{upsert.mockResolvedValueOnce({error:{message:'Network failure'}});await prepare();await submit();expect(onSaved).not.toHaveBeenCalled();expect(document.body.textContent).toContain('Tentar vincular novamente');await submit();expect(createTask).toHaveBeenCalledTimes(1);expect(onSaved).toHaveBeenCalledOnce();});
it('links an existing task without moving it or creating a new task',async()=>{await click('Vincular existente');await act(async()=>{const select=document.querySelector('select')!;select.value='existing';select.dispatchEvent(new Event('change',{bubbles:true}));});await submit();expect(createTask).not.toHaveBeenCalled();expect(upsert).toHaveBeenCalledWith({objective_id:'objective',task_id:'existing'},expect.anything());expect(onSaved).toHaveBeenCalledOnce();});
