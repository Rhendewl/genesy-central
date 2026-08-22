import { describe, expect, it } from "vitest";
import { parseInstagramWebhook } from "../webhook";

describe("Instagram webhook parser", () => {
  it("normalizes comment notifications", () => {
    const payload = { object: "instagram", entry: [{
      id: "ig-business", time: 1_700_000_000,
      changes: [{ field: "comments", value: { id: "comment-1", text: "Quero", from: { id: "person-1", username: "maria" }, media: { id: "media-1" } } }],
    }] };
    const events = parseInstagramWebhook(payload);
    expect(events).toEqual([expect.objectContaining({
      accountId: "ig-business", externalEventId: "comment:comment-1", eventType: "comment",
      senderScopedId: "person-1", senderUsername: "maria", commentId: "comment-1", text: "Quero",
    })]);
    expect(parseInstagramWebhook(payload)[0].externalEventId).toBe(events[0].externalEventId);
  });

  it("normalizes DMs, story replies and ignores self echoes", () => {
    const events = parseInstagramWebhook({ object: "instagram", entry: [{ id: "ig-business", messaging: [
      { sender: { id: "person-1" }, timestamp: 1_700_000_000_000, message: { mid: "m1", text: "Oi" } },
      { sender: { id: "person-2" }, message: { mid: "m2", text: "Story", reply_to: { story: { id: "s1" } } } },
      { sender: { id: "ig-business" }, message: { mid: "m3", text: "echo", is_echo: true } },
    ] }] });
    expect(events.map(event => event.eventType)).toEqual(["message", "story_reply"]);
    expect(events.map(event => event.externalEventId)).toEqual(["message:m1", "story_reply:m2"]);
  });

  it("normalizes postbacks and rejects unrelated objects", () => {
    expect(parseInstagramWebhook({ object: "page", entry: [] })).toEqual([]);
    const [event] = parseInstagramWebhook({ object: "instagram", entry: [{ id: "ig", messaging: [{
      sender: { id: "person" }, timestamp: 123, postback: { mid: "p1", title: "Começar", payload: "START" },
    }] }] });
    expect(event).toEqual(expect.objectContaining({ eventType: "postback", text: "START", externalEventId: "postback:p1" }));
  });
});
