// All text/vision AI features use the built-in Lovable AI Gateway (LOVABLE_API_KEY).
// (File name kept for import stability.)
import { createOpenAI } from "@ai-sdk/openai";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
export const CHAT_MODEL = "openai/gpt-6-astra";

function apiKey() {
  const k = process.env["LOVABLE_API_KEY"];
  if (!k) throw new Error("AI service is not configured.");
  return k;
}

/** Returns an object exposing `.responses(model)` so existing call sites keep working. */
export function openaiProvider() {
  const openai = createOpenAI({
    baseURL: GATEWAY,
    apiKey: apiKey(),
    headers: { "Lovable-API-Key": apiKey(), "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  return { responses: (model: string) => openai.responses(model) };
}

export const openaiOptions = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
} as const;
