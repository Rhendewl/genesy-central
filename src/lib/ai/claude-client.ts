import Anthropic from "@anthropic-ai/sdk";

export interface CopyResult {
  headline: string;
  copy: string;
  cta: string;
  tokensUsed: number;
}

function parseCopyResponse(text: string): { headline: string; copy: string; cta: string } {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { headline: "Oportunidade Única", copy: "Não perca esta chance exclusiva.", cta: "Saiba Mais" };
  }
}

export async function generateCopy(prompt: string, apiKey: string): Promise<CopyResult> {
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("");

  const parsed = parseCopyResponse(text);

  return {
    headline:   parsed.headline ?? "Oportunidade Única",
    copy:       parsed.copy ?? "Descubra mais sobre esta oferta.",
    cta:        parsed.cta ?? "Saiba Mais",
    tokensUsed: (message.usage?.input_tokens ?? 0) + (message.usage?.output_tokens ?? 0),
  };
}
