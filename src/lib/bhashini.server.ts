// Speech-to-text, translation and text-to-speech through the owner's OpenAI account.
import { streamText } from "ai";
import {
  CHAT_MODEL,
  STT_MODEL,
  TTS_MODEL,
  openaiFetch,
  openaiOptions,
  openaiProvider,
} from "./openai.server";

/** Transcribe 16 kHz mono WAV (base64). */
export async function bhashiniAsr(audioBase64: string, lang: string) {
  const bytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "audio/wav" }), "speech.wav");
  form.append("model", STT_MODEL);
  form.append("language", lang);
  form.append("response_format", "json");
  const res = await openaiFetch("/audio/transcriptions", { method: "POST", body: form });
  const j = (await res.json()) as { text?: string };
  return (j.text ?? "").trim();
}

/** Translate texts between languages. */
export async function bhashiniTranslate(texts: string[], source: string, target: string) {
  if (source === target || !texts.length) return texts;
  let streamError: unknown = null;
  const result = streamText({
    model: openaiProvider().responses(CHAT_MODEL),
    maxRetries: 0,
    onError: ({ error }) => {
      streamError = error;
    },
    system:
      "You are a translation engine. Translate each input line from the source language to the target language. " +
      "Return ONLY the translations, one per line, in the same order, with no numbering, quotes or commentary. " +
      "Preserve meaning, numbers, standard codes (like IS 277) and units exactly.",
    prompt: `Source language code: ${source}\nTarget language code: ${target}\n\n${texts.join("\n")}`,
    providerOptions: openaiOptions,
  });
  let out = "";
  try {
    out = (await result.text).trim();
  } catch (e) {
    console.error("Translation failed", streamError ?? e);
    return texts;
  }
  const lines = out.split("\n").map((l) => l.trim());
  return texts.map((t, i) => lines[i] || t);
}

/** Synthesize speech (returns base64 WAV). */
export async function bhashiniTts(text: string, _lang: string) {
  const res = await openaiFetch("/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: "coral",
      input: text,
      instructions: "Speak clearly and naturally, in the language of the text.",
      response_format: "wav",
    }),
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
