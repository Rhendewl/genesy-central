// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { DraftAutosaver } from "../draft-autosaver";
const initial = {notes:"Original", name:"Lead", tags:["one"]};
afterEach(()=>vi.useRealTimers());
it("debounces typing, sends only changed fields and does not write on opening",async()=>{
 vi.useFakeTimers();const persist=vi.fn().mockResolvedValue({error:null});const draft=new DraftAutosaver(initial,persist);
 draft.update(initial,true);await vi.advanceTimersByTimeAsync(1000);expect(persist).not.toHaveBeenCalled();
 draft.update({...initial,notes:"A"},true);await vi.advanceTimersByTimeAsync(400);
 draft.update({...initial,notes:"AB"},true);await vi.advanceTimersByTimeAsync(799);expect(persist).not.toHaveBeenCalled();
 await vi.advanceTimersByTimeAsync(1);expect(persist).toHaveBeenCalledExactlyOnceWith({notes:"AB"});expect(draft.status).toBe("saved");
});
it("serializes requests and flushes the latest edit before closing",async()=>{
 let resolve!:(value:{error:null})=>void;const first=new Promise<{error:null}>(r=>resolve=r);
 const persist=vi.fn().mockReturnValueOnce(first).mockResolvedValue({error:null});const draft=new DraftAutosaver(initial,persist);
 draft.update({...initial,notes:"First"},true);const flush=draft.flush();await Promise.resolve();
 draft.update({...initial,notes:"Latest",tags:["two"]},true);const closing=draft.flush();expect(persist).toHaveBeenCalledTimes(1);
 resolve({error:null});expect(await closing).toBe(true);await flush;
 expect(persist.mock.calls).toEqual([[{notes:"First"}],[{notes:"Latest",tags:["two"]}]]);expect(draft.dirty).toBe(false);
});
it("preserves a draft on failure and retries without reporting saved",async()=>{
 const persist=vi.fn().mockRejectedValueOnce(Error("offline")).mockResolvedValue({error:null});const draft=new DraftAutosaver(initial,persist);
 draft.update({...initial,notes:"Keep me"},true);expect(await draft.flush()).toBe(false);expect(draft.status).toBe("error");expect(draft.dirty).toBe(true);
 expect(await draft.flush()).toBe(true);expect(persist).toHaveBeenLastCalledWith({notes:"Keep me"});expect(draft.status).toBe("saved");
});
it("prevents invalid writes and saves after correction",async()=>{
 const persist=vi.fn().mockResolvedValue({error:null});const draft=new DraftAutosaver(initial,persist);
 draft.update({...initial,name:""},false);expect(await draft.flush()).toBe(false);expect(persist).not.toHaveBeenCalled();
 draft.update({...initial,name:"Corrected"},true);await draft.flush();expect(persist).toHaveBeenCalledWith({name:"Corrected"});
});
it("restores the original value if the user reverts while an older write is pending",async()=>{
 let resolve!:(value:{error:null})=>void;const persist=vi.fn().mockImplementationOnce(()=>new Promise(r=>resolve=r)).mockResolvedValue({error:null});const draft=new DraftAutosaver(initial,persist);
 draft.update({...initial,notes:"Temporary"},true);const saved=draft.flush();await Promise.resolve();draft.update(initial,true);resolve({error:null});await saved;
 expect(persist.mock.calls).toEqual([[{notes:"Temporary"}],[{notes:"Original"}]]);
});

it("allows closing an untouched legacy record even if its required fields are incomplete",async()=>{
 const persist=vi.fn();const draft=new DraftAutosaver(initial,persist);draft.update(initial,false);expect(await draft.flush()).toBe(true);expect(persist).not.toHaveBeenCalled();
});
