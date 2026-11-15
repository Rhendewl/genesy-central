import {DiscoveryError} from "./discovery-error";
import type { SupabaseClient } from "@supabase/supabase-js";
import { discover, discoveryConfig } from "./competitor-discovery";
export async function syncCompetitor(
  db: SupabaseClient,
  organizationId: string,
  id: string,
) {
  discoveryConfig(organizationId);
  const now = new Date().toISOString();
  // Atomic claim prevents concurrent manual/cron requests and enforces daily pacing even on failure.
  const { data: profile, error } = await db
    .from("marketing_competitors")
    .update({ next_sync_at: new Date(Date.now() + 86400000).toISOString() })
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("active", true)
    .lte("next_sync_at", now)
    .select("username,instagram_id")
    .maybeSingle();
  if (error) throw new Error("Não foi possível reservar a coleta.");
  if (!profile)
    throw Object.assign(
      new Error("Perfil pausado ou coleta já realizada nas últimas 24 horas."),
      { status: 409 },
    );
  try {
    const observation = await discover(organizationId, profile.username);
    if (
      profile.instagram_id &&
      profile.instagram_id !== observation.instagram_id
    )
      throw Object.assign(
        new Error(
          "Este @ passou a identificar outra conta. Pause o perfil e revise o cadastro para preservar o histórico.",
        ),
        { status: 409 },
      );
    const saved = await db.rpc("save_competitor_observation", {
      p_id: id,
      p_org: organizationId,
      p_data: observation,
    });
    if (saved.error)
      throw new Error(
        "Não foi possível salvar a coleta. O histórico anterior foi preservado.",
      );
    return { collected: observation.posts.length };
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "status" in error &&
      error.status === 429
    ) {
      const deferred = await db
        .from("marketing_competitors")
        .update({ next_sync_at: new Date(Date.now() + 86400000).toISOString() })
        .eq("organization_id", organizationId);
      if (deferred.error)
        throw new Error("Falha ao adiar as coletas após limite da Meta.");
    }
    if(error instanceof DiscoveryError) console.warn("instagram_discovery_failed",{profileId:id,kind:error.kind,code:error.metaCode,subcode:error.metaSubcode,detail:error.diagnostic});
    const message =
      error instanceof Error && "status" in error
        ? error.message
        : "Falha na coleta ou gravação. Tente novamente na próxima janela.";
    const saved = await db
      .from("marketing_competitors")
      .update({ sync_error: message })
      .eq("id", id)
      .eq("organization_id", organizationId);
    if (saved.error)
      throw new Error("Falha na coleta e no registro de status.");
    if(error instanceof DiscoveryError) throw error;
    throw Object.assign(new Error(message), {
      status:
        typeof error === "object" && error && "status" in error
          ? error.status
          : 502,
    });
  }
}
