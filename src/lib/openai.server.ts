// All AI features use the project owner's own OpenAI account (OPENAI_API_KEY).
import { createOpenAI } from "@ai-sdk/openai";

export const CHAT_MODEL = "gpt-5-mini";
export const STT_MODEL = "gpt-4o-mini-transcribe";
export const TTS_MODEL = "gpt-4o-mini-tts";

export function openaiKey() {
  const k = process.env["OPENAI_API_KEY"];
  if (!k) throw new Error("OpenAI key is not configured.");
  return k;
}

export function openaiProvider() {
  return createOpenAI({ apiKey: openaiKey() });
}

export const openaiOptions = {
  openai: { reasoningEffort: "low", store: false },
} as const;

export async function openaiFetch(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${openaiKey()}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("OpenAI error", res.status, text.slice(0, 300));
    if (res.status === 401) throw new Error("Your OpenAI key was rejected. Please update it.");
    if (res.status === 429)
      throw new Error(
        /quota/i.test(text)
          ? "Your OpenAI account has no credit left. Add billing at platform.openai.com."
          : "OpenAI is busy right now. Please try again shortly.",
      );
    throw new Error(`Voice service error (${res.status}). Please try again.`);
  }
  return res;
}
