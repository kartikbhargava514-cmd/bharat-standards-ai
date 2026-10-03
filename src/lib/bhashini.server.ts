// Speech-to-text, translation and text-to-speech through the built-in
// Lovable AI Gateway (no external keys needed).
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const STT_MODEL = "google/gemini-3.5-transcribe";
const TTS_MODEL = "google/gemini-3.1-flash-tts-preview";
const CHAT_MODEL = "openai/gpt-6-astra";

function apiKey() {
  const k = process.env["LOVABLE_API_KEY"];
  if (!k) throw new Error("AI service is not configured.");
  return k;
}

async function gatewayFetch(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${apiKey()}`,
      "Lovable-API-Key": apiKey(),
      "X-Lovable-AIG-SDK": "fetch",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("AI gateway error", res.status, text.slice(0, 300));
    let message = `Language service error (${res.status}). Please try again.`;
    try {
      const j = JSON.parse(text) as { message?: string; error?: { message?: string } };
      if (res.status === 402 && (j.message ?? j.error?.message))
        message = j.message ?? j.error?.message ?? message;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }
  return res;
}

/** Transcribe 16 kHz mono WAV (base64) using the built-in transcription model. */
export async function bhashiniAsr(audioBase64: string, lang: string) {
  const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "audio/wav" }), "speech.wav");
  form.append("model", STT_MODEL);
  form.append("language", lang);
  form.append("stream", "true");

  const res = await gatewayFetch("/audio/transcriptions", { method: "POST", body: form });
  const body = await res.text();
  let text = "";
  for (const line of body.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const evt = JSON.parse(payload) as { type?: string; delta?: string; text?: string };
      if (evt.type?.endsWith(".done") && evt.text) text = evt.text;
      else if (evt.delta) text += evt.delta;
    } catch {
      /* ignore keep-alives */
    }
  }
  return text.trim();
}

/** Translate texts between languages using the built-in chat model. */
export async function bhashiniTranslate(texts: string[], source: string, target: string) {
  if (source === target || !texts.length) return texts;
  const openai = createOpenAI({
    baseURL: GATEWAY,
    apiKey: apiKey(),
    headers: { "Lovable-API-Key": apiKey(), "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  let streamError: unknown = null;
  const result = streamText({
    model: openai.responses(CHAT_MODEL),
    maxRetries: 0,
    onError: ({ error }) => {
      streamError = error;
    },
    system:
      "You are a translation engine. Translate each input line from the source language to the target language. " +
      "Return ONLY the translations, one per line, in the same order, with no numbering, quotes or commentary. " +
      "Preserve meaning, numbers, standard codes (like IS 277) and units exactly.",
    prompt: `Source language code: ${source}\nTarget language code: ${target}\n\n${texts.join("\n")}`,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  let out = "";
  try {
    out = (await result.text).trim();
  } catch (e) {
    console.error("Translation failed", streamError ?? e);
    // Fall back to the original text so the app keeps working.
    return texts;
  }
  const lines = out.split("\n").map((l) => l.trim());
  return texts.map((t, i) => lines[i] || t);
}

/** Synthesize speech (returns base64 WAV) using the built-in TTS model. */
export async function bhashiniTts(text: string, _lang: string) {
  const res = await gatewayFetch("/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      stream_format: "audio",
      contents: [{ role: "user", parts: [{ text: `Say clearly and naturally: ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      },
    }),
  });
  const buf = await res.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
