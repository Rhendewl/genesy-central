import OpenAI from "openai";

export interface ImageResult {
  url: string;
  revisedPrompt: string;
}

export async function generateImage(
  prompt: string,
  apiKey: string,
  size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1024"
): Promise<ImageResult> {
  const client = new OpenAI({ apiKey });

  console.log("[OPENAI] Chamando images.generate — gpt-image-1,", size);
  console.log("[OPENAI] Prompt:", prompt.slice(0, 120) + (prompt.length > 120 ? "..." : ""));

  // gpt-image-1: endpoint /v1/images/generations
  // Retorna b64_json por padrão (não URL)
  // Parâmetros: size = 1024x1024 | 1536x1024 | 1024x1536 | auto
  //             quality = low | medium | high | auto
  const response = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    n: 1,
    size,
    quality: "medium",
  });

  const image = response.data?.[0];

  if (!image) {
    console.error("[OPENAI] Resposta vazia:", JSON.stringify(response));
    throw new Error("OpenAI não retornou dados de imagem. Verifique sua cota e chave API.");
  }

  // gpt-image-1 retorna base64 — converte para data URL para exibição direta
  if (image.b64_json) {
    const dataUrl = `data:image/png;base64,${image.b64_json}`;
    console.log("[OPENAI] Imagem gerada (base64) — tamanho:", image.b64_json.length, "chars");
    return {
      url: dataUrl,
      revisedPrompt: prompt,
    };
  }

  // Fallback: se por algum motivo retornou URL
  if (image.url) {
    console.log("[OPENAI] Imagem gerada (URL fallback):", image.url.slice(0, 60) + "...");
    return {
      url: image.url,
      revisedPrompt: prompt,
    };
  }

  console.error("[OPENAI] Resposta sem b64_json e sem URL:", JSON.stringify(image));
  throw new Error("OpenAI não retornou imagem válida. Verifique seu acesso ao modelo gpt-image-1.");
}

// Image-conditioned generation — raw fetch + FormData para controle total sobre gpt-image-1 edits
// O SDK da OpenAI tem tipos de size limitados ao DALL-E 2 e não suporta quality no edit,
// então usamos fetch direto para passar os parâmetros corretos do gpt-image-1.
export async function generateImageWithReference(
  referenceUrl: string,
  prompt: string,
  apiKey: string,
  size: "1024x1024" | "1024x1536" | "1536x1024"
): Promise<ImageResult> {
  console.log("[OPENAI] Baixando imagem de referência:", referenceUrl.slice(0, 80));

  const fetchRes = await fetch(referenceUrl);
  if (!fetchRes.ok) {
    throw new Error(
      `Falha ao baixar imagem de referência (HTTP ${fetchRes.status}). Verifique a URL do asset.`
    );
  }

  const buffer      = await fetchRes.arrayBuffer();
  const contentType = fetchRes.headers.get("content-type")?.split(";")[0]?.trim() || "image/png";

  console.log("[OPENAI] Referência — tipo:", contentType, "| bytes:", buffer.byteLength);

  // FormData direto — evita limitações de tipo do SDK para gpt-image-1
  const form = new FormData();
  form.append("model",  "gpt-image-1");
  form.append("prompt", prompt);
  form.append("n",      "1");
  form.append("size",   size);
  form.append("image",  new Blob([buffer], { type: contentType }), "reference.png");

  console.log("[OPENAI] POST /v1/images/edits — gpt-image-1,", size);
  console.log("[OPENAI] Prompt:", prompt.slice(0, 120) + (prompt.length > 120 ? "..." : ""));

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method:  "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body:    form,
  });

  if (!res.ok) {
    const body   = await res.json().catch(() => ({})) as { error?: { message?: string } };
    const errMsg = body.error?.message ?? `HTTP ${res.status}`;
    console.error("[OPENAI] Erro no /images/edits:", errMsg);
    throw new Error(`Geração por referência falhou: ${errMsg}`);
  }

  const data  = await res.json() as { data?: Array<{ b64_json?: string; url?: string }> };
  const image = data.data?.[0];

  if (!image) {
    throw new Error("OpenAI não retornou imagem na geração por referência.");
  }

  if (image.b64_json) {
    console.log("[OPENAI] Imagem gerada por referência (base64) — chars:", image.b64_json.length);
    return { url: `data:image/png;base64,${image.b64_json}`, revisedPrompt: prompt };
  }
  if (image.url) {
    console.log("[OPENAI] Imagem gerada por referência (URL):", image.url.slice(0, 60));
    return { url: image.url, revisedPrompt: prompt };
  }

  throw new Error("OpenAI não retornou imagem válida na geração por referência.");
}

export interface OpenAICopyResult {
  headline: string;
  copy: string;
  cta: string;
  tokensUsed: number;
}

// GPT-4o como alternativa ao Claude para geração de copy
export async function generateCopyOpenAI(prompt: string, apiKey: string): Promise<OpenAICopyResult> {
  const client = new OpenAI({ apiKey });

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  let parsed: { headline?: string; copy?: string; cta?: string } = {};
  try { parsed = JSON.parse(text); } catch { /* usa fallback abaixo */ }

  return {
    headline:   parsed.headline ?? "Oportunidade Única",
    copy:       parsed.copy ?? "Descubra mais sobre esta oferta.",
    cta:        parsed.cta ?? "Saiba Mais",
    tokensUsed: (response.usage?.total_tokens ?? 0),
  };
}
