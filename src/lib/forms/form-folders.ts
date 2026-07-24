import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureClientFormFolder(
  supabase: SupabaseClient,
  userId: string,
  client: { id: string; name: string },
): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from("form_folders")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", client.id)
    .maybeSingle();
  if (findError) throw new Error(findError.message);
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("form_folders")
    .insert({ user_id: userId, created_by: userId, client_id: client.id, name: client.name })
    .select("id")
    .single();

  if (!createError && created) return created.id;
  if (createError?.code !== "23505") throw new Error(createError?.message ?? "Erro ao criar pasta do cliente");

  const { data: concurrent, error: concurrentError } = await supabase
    .from("form_folders")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", client.id)
    .single();
  if (concurrentError || !concurrent) throw new Error(concurrentError?.message ?? "Pasta do cliente não encontrada");
  return concurrent.id;
}
