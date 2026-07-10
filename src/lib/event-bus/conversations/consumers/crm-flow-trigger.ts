import type { SupabaseClient } from "@supabase/supabase-js";
import type { LeadStageEnteredPayload } from "@/lib/event-bus/domain-events";
import type { BusEvent, EventConsumer } from "@/lib/event-bus/types";
import { ConsumerPriority } from "@/lib/event-bus/types";
import { enqueueConversationTrigger } from "@/lib/conversations/trigger-service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = SupabaseClient<any, any, any>;

type LeadRow = {
  id: string;
  user_id: string;
  name: string | null;
  contact: string | null;
  email: string | null;
  source: string | null;
  pipeline_id: string | null;
  stage_id: string | null;
  assigned_to: string | null;
};

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

async function resolveOwnerProfileId(db: Db, lead: LeadRow, account: AccountRow | null) {
  if (lead.assigned_to) return lead.assigned_to;
  if (account?.owner_profile_id) return account.owner_profile_id;

  const { data: profile } = await db
    .from("user_profiles")
    .select("id")
    .eq("owner_id", lead.user_id)
    .eq("role", "admin")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle<ProfileRow>();

  return profile?.id ?? null;
}

async function resolveAccount(db: Db, lead: LeadRow) {
  if (lead.assigned_to) {
    const { data: assignedAccount } = await db
      .from("conversation_whatsapp_accounts")
      .select("id,owner_profile_id")
      .eq("user_id", lead.user_id)
      .eq("owner_profile_id", lead.assigned_to)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<AccountRow>();
    if (assignedAccount) return assignedAccount;
  }

  const { data: account } = await db
    .from("conversation_whatsapp_accounts")
    .select("id,owner_profile_id")
    .eq("user_id", lead.user_id)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<AccountRow>();

  return account ?? null;
}

async function resolveThreadForLead(db: Db, lead: LeadRow) {
  const phone = normalizePhone(lead.contact);
  if (!phone) return { contactId: null, threadId: null, whatsappAccountId: null, ownerProfileId: lead.assigned_to };

  const account = await resolveAccount(db, lead);
  const ownerProfileId = await resolveOwnerProfileId(db, lead, account);
  if (!ownerProfileId) return { contactId: null, threadId: null, whatsappAccountId: account?.id ?? null, ownerProfileId: null };

  const { data: contact } = await db
    .from("conversation_contacts")
    .upsert({
      user_id: lead.user_id,
      lead_id: lead.id,
      name: lead.name,
      phone,
      email: lead.email,
    }, { onConflict: "user_id,phone" })
    .select("id")
    .single<ContactRow>();

  if (!contact) return { contactId: null, threadId: null, whatsappAccountId: account?.id ?? null, ownerProfileId };

  const { data: existingThread } = await db
    .from("conversation_threads")
    .select("id,owner_profile_id,whatsapp_account_id")
    .eq("user_id", lead.user_id)
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
      user_id: lead.user_id,
      whatsapp_account_id: account?.id ?? null,
      contact_id: contact.id,
      owner_profile_id: ownerProfileId,
      lead_id: lead.id,
      status: "open",
      last_message_preview: "Fluxo iniciado pelo CRM",
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

export function createConversationCrmFlowTriggerConsumer(db: Db): EventConsumer {
  return {
    name: "conversations.crm-flow-trigger",
    priority: ConsumerPriority.NORMAL,
    events: ["lead.stage.entered"],

    async handle(event: BusEvent): Promise<void> {
      const payload = event.payload as LeadStageEnteredPayload;
      if (!payload?.leadId || !payload?.userId || !payload?.stageId) return;

      const { data: lead } = await db
        .from("leads")
        .select("id,user_id,name,contact,email,source,pipeline_id,stage_id,assigned_to")
        .eq("id", payload.leadId)
        .maybeSingle<LeadRow>();

      if (!lead) return;

      const triggerType = payload.fromStageId ? "stage_changed" : "lead_created";
      const threadContext = await resolveThreadForLead(db, lead);

      await enqueueConversationTrigger(db, {
        userId: lead.user_id,
        triggerType,
        threadId: threadContext.threadId,
        whatsappAccountId: threadContext.whatsappAccountId,
        ownerProfileId: threadContext.ownerProfileId,
        leadId: lead.id,
        // event.id é estável entre retries do próprio EventBus (dispatchToConsumer
        // reusa o mesmo BusEvent a cada tentativa) — suprime job duplicado se
        // este consumer for reexecutado após uma falha transitória.
        dedupeKey: `event:${event.id}`,
        snapshot: {
          lead_id: lead.id,
          lead_name: lead.name ?? "",
          lead_phone: lead.contact ?? "",
          lead_email: lead.email ?? "",
          lead_source: lead.source ?? "",
          pipeline_id: payload.pipelineId,
          stage_id: payload.stageId,
          from_stage_id: payload.fromStageId,
          event_type: triggerType,
        },
      });
    },
  };
}
