// All AI features use the project owner's own Google Gemini account (GEMINI_API_KEY).
// (File name kept for import stability.)
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const CHAT_MODEL = "gemini-2.5-flash";
export const STT_MODEL = "gemini-2.5-flash";
export const TTS_MODEL = "gemini-2.5-flash-preview-tts";

export function geminiKey() {
  const k = process.env["GEMINI_API_KEY"];
  if (!k) throw new Error("Gemini key is not configured.");
  return k;
}

/** Returns an object exposing `.responses(model)` so existing call sites keep working. */
export function openaiProvider() {
  const google = createGoogleGenerativeAI({ apiKey: geminiKey() });
  return { responses: (model: string) => google(model) };
}

export const openaiOptions = {} as const;

export async function geminiFetch(model: string, body: unknown): Promise<unknown> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey() },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Gemini error", res.status, text.slice(0, 300));
    if (res.status === 400 && /API key/i.test(text)) throw new Error("Your Gemini key was rejected. Please update it.");
    if (res.status === 401 || res.status === 403) throw new Error("Your Gemini key was rejected. Please update it.");
    if (res.status === 429) throw new Error("Gemini limit reached right now. Please try again shortly.");
    throw new Error(`Voice service error (${res.status}). Please try again.`);
  }
  return res.json();
}
