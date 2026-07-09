import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingCreatedPayload } from "@/lib/event-bus/domain-events";
import type { BusEvent, EventConsumer } from "@/lib/event-bus/types";
import { ConsumerPriority } from "@/lib/event-bus/types";
import { enqueueConversationTrigger } from "@/lib/conversations/trigger-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

type AccountRow = {
  id: string;
  owner_profile_id: string;
};

type ProfileRow = {
  id: string;
};

type ContactRow = {
  id: string;
};

type ThreadRow = {
  id: string;
  owner_profile_id: string;
  whatsapp_account_id: string | null;
};

function normalizePhone(value: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

async function resolveAccount(db: Db, userId: string) {
  const { data: account } = await db
    .from("conversation_whatsapp_accounts")
    .select("id,owner_profile_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<AccountRow>();

  return account ?? null;
}

async function resolveAdminProfileId(db: Db, userId: string) {
  const { data: profile } = await db
    .from("user_profiles")
    .select("id")
    .eq("owner_id", userId)
    .eq("role", "admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<ProfileRow>();

  return profile?.id ?? null;
}

async function resolveThreadForBooking(db: Db, payload: BookingCreatedPayload) {
  const phone = normalizePhone(payload.visitorPhone);
  if (!phone) return null;

  const account = await resolveAccount(db, payload.userId);
  const ownerProfileId = account?.owner_profile_id ?? await resolveAdminProfileId(db, payload.userId);
  if (!ownerProfileId) return null;

  const { data: contact } = await db
    .from("conversation_contacts")
    .upsert({
      user_id: payload.userId,
      lead_id: payload.leadId,
      name: payload.visitorName || null,
      phone,
      email: payload.visitorEmail || null,
    }, { onConflict: "user_id,phone" })
    .select("id")
    .single<ContactRow>();

  if (!contact) return null;

  const { data: existingThread } = await db
    .from("conversation_threads")
    .select("id,owner_profile_id,whatsapp_account_id")
    .eq("user_id", payload.userId)
    .eq("contact_id", contact.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<ThreadRow>();

  if (existingThread) {
    return {
      contactId: contact.id,
      threadId: existingThread.id,
      whatsappAccountId: existingThread.whatsapp_account_id ?? account?.id ?? null,
      ownerProfileId: existingThread.owner_profile_id,
    };
  }

  const now = new Date().toISOString();
  const { data: thread } = await db
    .from("conversation_threads")
    .insert({
      user_id: payload.userId,
      whatsapp_account_id: account?.id ?? null,
      contact_id: contact.id,
      owner_profile_id: ownerProfileId,
      lead_id: payload.leadId,
      status: "open",
      last_message_preview: "Fluxo iniciado por agendamento",
      last_message_at: now,
      unread_count: 0,
      needs_response: false,
    })
    .select("id,owner_profile_id,whatsapp_account_id")
    .single<ThreadRow>();

  return {
    contactId: contact.id,
    threadId: thread?.id ?? null,
    whatsappAccountId: thread?.whatsapp_account_id ?? account?.id ?? null,
    ownerProfileId: thread?.owner_profile_id ?? ownerProfileId,
  };
}

export function createConversationBookingFlowTriggerConsumer(db: Db): EventConsumer {
  return {
    name: "conversations.booking-flow-trigger",
    priority: ConsumerPriority.NORMAL,
    events: ["booking.created"],

    async handle(event: BusEvent): Promise<void> {
      const payload = event.payload as BookingCreatedPayload;
      if (!payload?.bookingId || !payload?.calendarId || !payload?.userId) return;

      const threadContext = await resolveThreadForBooking(db, payload);
      if (!threadContext) return;

      await enqueueConversationTrigger(db, {
        userId: payload.userId,
        triggerType: "appointment_created",
        threadId: threadContext.threadId,
        whatsappAccountId: threadContext.whatsappAccountId,
        ownerProfileId: threadContext.ownerProfileId,
        leadId: payload.leadId,
        snapshot: {
          event_type: "appointment_created",
          booking_id: payload.bookingId,
          calendar_id: payload.calendarId,
          calendar_name: payload.calendarName,
          visitor_name: payload.visitorName,
          visitor_email: payload.visitorEmail,
          visitor_phone: payload.visitorPhone ?? "",
          starts_at: payload.startsAt,
          attribution: payload.attribution,
        },
      });
    },
  };
}
