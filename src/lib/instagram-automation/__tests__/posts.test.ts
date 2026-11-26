import { describe, expect, it } from "vitest";
import { eligibleAutomations } from "../matching";
import { sanitizeInstagramAutomationInput, sanitizeMediaIds } from "../validation";

const base = {
  organization_id: "org", connection_id: "conn", trigger_type: "comment" as const, public_reply_text: null,
  steps: [], flow: null, crm_enabled: false, crm_pipeline_id: null, crm_stage_id: null, crm_origin_id: null,
  crm_assigned_to: null, crm_deal_value: 0,
};
const automation = (id: string, extra: Record<string, unknown>) => ({ ...base, id, match_type: "contains" as const, keywords: ["quero"], media_ids: [], ...extra });

describe("posts escolhidos no gatilho de comentário", () => {
  it("só dispara em comentários dos posts escolhidos", () => {
    const list = [automation("a", { media_ids: ["111111"] })];
    expect(eligibleAutomations(list as never, { eventType: "comment", text: "quero", mediaId: "111111" }).map(item => item.id)).toEqual(["a"]);
    expect(eligibleAutomations(list as never, { eventType: "comment", text: "quero", mediaId: "222222" })).toEqual([]);
    expect(eligibleAutomations(list as never, { eventType: "comment", text: "quero", mediaId: null })).toEqual([]);
  });

  it("fluxos de posts específicos têm prioridade sobre os de todos os posts", () => {
    const list = [automation("todos", {}), automation("especifico", { media_ids: ["111111"] })];
    expect(eligibleAutomations(list as never, { eventType: "comment", text: "quero", mediaId: "111111" }).map(item => item.id)).toEqual(["especifico", "todos"]);
    expect(eligibleAutomations(list as never, { eventType: "comment", text: "quero", mediaId: "999999" }).map(item => item.id)).toEqual(["todos"]);
  });

  it("qualquer comentário só vale com posts escolhidos", () => {
    const any = automation("qualquer", { match_type: "any", keywords: [], media_ids: ["111111"] });
    const anyAll = automation("qualquer-todos", { match_type: "any", keywords: [] });
    expect(eligibleAutomations([any, anyAll] as never, { eventType: "comment", text: "oi", mediaId: "111111" }).map(item => item.id)).toEqual(["qualquer"]);
  });

  it("mensagens no Direct ignoram a lista de posts", () => {
    const dm = { ...automation("dm", { media_ids: ["111111"] }), trigger_type: "message" as const };
    expect(eligibleAutomations([dm] as never, { eventType: "message", text: "quero", mediaId: null }).map(item => item.id)).toEqual(["dm"]);
  });

  it("limpa ids inválidos e repetidos", () => {
    expect(sanitizeMediaIds(["17890000000000001", "abc", "17890000000000001", 42, null])).toEqual(["17890000000000001"]);
    expect(sanitizeMediaIds("x")).toEqual([]);
  });

  it("ativa qualquer comentário com posts escolhidos e recusa sem eles", () => {
    const body = { connectionId: "c", name: "Teste", status: "active" as const, triggerType: "comment" as const, matchType: "any" as const, keywords: [], steps: [{ type: "message" as const, text: "Oi", delayMinutes: 0 }] };
    expect(sanitizeInstagramAutomationInput({ ...body, mediaIds: ["17890000000000001"] }).mediaIds).toEqual(["17890000000000001"]);
    expect(() => sanitizeInstagramAutomationInput(body)).toThrow("posts específicos");
  });

  it("descarta posts quando o gatilho não é comentário", () => {
    const input = sanitizeInstagramAutomationInput({ connectionId: "c", name: "DM", status: "draft", triggerType: "message", matchType: "contains", keywords: ["oi"], mediaIds: ["17890000000000001"], steps: [{ type: "message", text: "Oi", delayMinutes: 0 }] });
    expect(input.mediaIds).toEqual([]);
  });
});
