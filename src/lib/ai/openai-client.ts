import OpenAI from "openai";

export interface ImageResult {
  url: string;
  revisedPrompt: string;
}

export async function generateImage(prompt: string, apiKey: string): Promise<ImageResult> {
  const client = new OpenAI({ apiKey });

  const response = await client.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
    quality: "standard",
    response_format: "url",
  });

  const image = response.data?.[0];
  if (!image?.url) throw new Error("OpenAI não retornou URL de imagem.");

  return {
    url: image.url,
    revisedPrompt: image.revised_prompt ?? prompt,
  };
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
