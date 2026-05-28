import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Geração de texto ──────────────────────────────────────────────────────────

export interface GeminiCopyResult {
  headline: string;
  copy: string;
  cta: string;
  tokensUsed: number;
}

export async function generateCopyGemini(prompt: string, apiKey: string): Promise<GeminiCopyResult> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  let parsed: { headline?: string; copy?: string; cta?: string } = {};
  try { parsed = JSON.parse(cleaned); } catch { /* usa fallback abaixo */ }

  return {
    headline:   parsed.headline ?? "Oportunidade Única",
    copy:       parsed.copy ?? "Descubra mais sobre esta oferta.",
    cta:        parsed.cta ?? "Saiba Mais",
    tokensUsed: result.response.usageMetadata?.totalTokenCount ?? 0,
  };
}

