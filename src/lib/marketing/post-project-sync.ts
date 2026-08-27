import type { PostTemplate } from "@/lib/marketing/post-generator";
import { getSupabaseClient } from "@/lib/supabase";

export type TimestampedPostProject = { updatedAt: number };

type ProjectWithContent = TimestampedPostProject & {
  slides?: Array<{
    media?: string[];
    backgroundImage?: string;
    textBlocks?: Array<{ content?: string }>;
  }>;
  tweetProfile?: { avatar?: string; name?: string; handle?: string };
};

type RemoteProjectDescriptor = {
  exists: boolean;
  storageUpdatedAt: string | null;
  signedUrl: string | null;
};

const DEFAULT_COPY = [
  "escreva aqui uma ideia forte simples e impossível de ignorar",
  "uma boa história começa com uma frase que prende",
  "continue a narrativa com clareza e ritmo",
];

export function postProjectHasUserContent(project: ProjectWithContent) {
  if ((project.slides?.length ?? 0) > 1) return true;
  if (project.tweetProfile?.avatar) return true;
  if (project.tweetProfile?.name && project.tweetProfile.name !== "Genesy Company") return true;
  if (project.tweetProfile?.handle && project.tweetProfile.handle !== "@genesycompany") return true;
  return Boolean(project.slides?.some((slide) => {
    if (slide.backgroundImage || slide.media?.some(Boolean)) return true;
    return slide.textBlocks?.some((block) => {
      const text = (block.content ?? "")
        .replace(/<[^>]*>/g, " ")
        .replace(/[^a-zA-Z0-9À-ÿ]+/g, " ")
        .trim()
        .toLocaleLowerCase("pt-BR");
      return text.length > 0 && !DEFAULT_COPY.includes(text);
    });
  }));
}

export function newestPostProject<T extends ProjectWithContent>(local: T | undefined, remote: T | undefined) {
  if (!local) return remote;
  if (!remote) return local;
  const localHasContent = postProjectHasUserContent(local);
  const remoteHasContent = postProjectHasUserContent(remote);
  if (localHasContent !== remoteHasContent) return localHasContent ? local : remote;
  return remote.updatedAt > local.updatedAt ? remote : local;
}

async function apiResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Não foi possível sincronizar o projeto.");
  return data;
}

export async function getRemotePostProject<T extends TimestampedPostProject>(template: PostTemplate) {
  const descriptor = await apiResponse<RemoteProjectDescriptor>(await fetch(
    `/api/marketing/post-generator?template=${encodeURIComponent(template)}`,
    { cache: "no-store" },
  ));
  if (!descriptor.exists || !descriptor.signedUrl) {
    return { project: undefined, storageUpdatedAt: descriptor.storageUpdatedAt };
  }
  const response = await fetch(descriptor.signedUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível baixar o projeto sincronizado.");
  return { project: await response.json() as T, storageUpdatedAt: descriptor.storageUpdatedAt };
}

export async function getRemotePostProjectIfChanged<T extends TimestampedPostProject>(template: PostTemplate, knownStorageUpdatedAt: string | null) {
  const descriptor = await apiResponse<RemoteProjectDescriptor>(await fetch(
    `/api/marketing/post-generator?template=${encodeURIComponent(template)}&known=${encodeURIComponent(knownStorageUpdatedAt ?? "")}`,
    { cache: "no-store" },
  ));
  if (!descriptor.exists || !descriptor.signedUrl) {
    return { project: undefined, storageUpdatedAt: descriptor.storageUpdatedAt, changed: false };
  }
  const response = await fetch(descriptor.signedUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível atualizar o projeto sincronizado.");
  return { project: await response.json() as T, storageUpdatedAt: descriptor.storageUpdatedAt, changed: true };
}

export async function saveRemotePostProject<T extends TimestampedPostProject>(template: PostTemplate, project: T) {
  const file = new Blob([JSON.stringify(project)], { type: "image/png" });
  const signed = await apiResponse<{ path: string; token: string }>(await fetch("/api/marketing/post-generator", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template, fileSize: file.size }),
  }));
  const upload = await getSupabaseClient().storage.from("criativos").uploadToSignedUrl(
    signed.path,
    signed.token,
    file,
    { contentType: "image/png" },
  );
  if (upload.error) throw new Error(upload.error.message || "Não foi possível enviar o projeto sincronizado.");
  // Força a próxima verificação a ler a versão efetivamente mais recente. Isso
  // cobre o caso raro de outra sessão salvar entre este upload e a reconciliação.
  return null;
}
