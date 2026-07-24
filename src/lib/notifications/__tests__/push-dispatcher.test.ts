import { afterEach, describe, expect, it } from "vitest";
import { dispatchPushToUser } from "../push-dispatcher";

function dbWithSubscriptions(rows: Record<string, string>[]) {
  return {
    from() {
      return {
        select: () => ({
          eq: async () => ({ data: rows, error: null }),
        }),
      };
    },
  };
}

describe("dispatchPushToUser", () => {
  const previousSubject = process.env.VAPID_SUBJECT;
  const previousPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const previousPrivate = process.env.VAPID_PRIVATE_KEY;

  afterEach(() => {
    process.env.VAPID_SUBJECT = previousSubject;
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = previousPublic;
    process.env.VAPID_PRIVATE_KEY = previousPrivate;
  });

  it("informa quando o usuário não possui dispositivo inscrito", async () => {
    const result = await dispatchPushToUser(dbWithSubscriptions([]) as never, "user-1", "Título", "Corpo");

    expect(result).toEqual({
      subscriptions: 0,
      accepted: 0,
      failed: 0,
      removed: 0,
      skippedReason: "no_subscriptions",
    });
  });

  it("não informa entrega quando as chaves VAPID estão ausentes", async () => {
    delete process.env.VAPID_SUBJECT;
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;

    const result = await dispatchPushToUser(
      dbWithSubscriptions([{ endpoint: "https://push.example/sub", p256dh: "key", auth_key: "auth" }]) as never,
      "user-1",
      "Título",
      "Corpo",
    );

    expect(result).toEqual({
      subscriptions: 1,
      accepted: 0,
      failed: 0,
      removed: 0,
      skippedReason: "vapid_not_configured",
    });
  });
});
