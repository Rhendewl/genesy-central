import { describe, it, expect, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
const {db,query}=vi.hoisted(()=>{const query=vi.fn();const channel={on:vi.fn(),subscribe:vi.fn()};channel.on.mockReturnValue(channel);channel.subscribe.mockReturnValue(channel);return {query,db:{from:()=>({select:()=>({in:query})}),channel:()=>channel,removeChannel:vi.fn()}};});
vi.mock('@/lib/supabase',()=>({getSupabaseClient:()=>db}));
import {useBscMetrics} from '../useBscMetrics';
describe('BSC immediate metric refresh',()=>{
 it('refreshes cards after save events even without a realtime message, without hiding the panel',async()=>{
 vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);query.mockResolvedValue({data:[{id:'m',current_value:6000}],error:null});let state:ReturnType<typeof useBscMetrics>|undefined;function Probe(){state=useBscMetrics(['o']);return null;}const root=createRoot(document.createElement('div'));
 try{await act(async()=>root.render(createElement(Probe)));expect(state?.metrics[0].current_value).toBe(6000);expect(state?.loading).toBe(false);query.mockResolvedValue({data:[{id:'m',current_value:20000}],error:null});await act(async()=>{window.dispatchEvent(new Event('workspace-bsc-metrics-changed'));});expect(state?.metrics[0].current_value).toBe(20000);expect(state?.loading).toBe(false);}finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
 });
});
