// Speech-to-text, translation and text-to-speech through the owner's Gemini account.
import { streamText } from "ai";
import { CHAT_MODEL, STT_MODEL, TTS_MODEL, geminiFetch, openaiProvider } from "./openai.server";

type GenResp = { candidates?: { content?: { parts?: { text?: string; inlineData?: { data?: string } }[] } }[] };

/** Transcribe 16 kHz mono WAV (base64). */
export async function bhashiniAsr(audioBase64: string, lang: string) {
  const j = (await geminiFetch(STT_MODEL, {
    contents: [
      {
        role: "user",
        parts: [
          { text: `Transcribe this speech exactly (language hint: ${lang}). Return only the transcript.` },
          { inlineData: { mimeType: "audio/wav", data: audioBase64 } },
        ],
      },
    ],
  })) as GenResp;
  return (j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
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

/** Synthesize speech (returns base64 WAV). Gemini returns 24 kHz 16-bit mono PCM. */
export async function bhashiniTts(text: string, _lang: string) {
  const j = (await geminiFetch(TTS_MODEL, {
    contents: [{ role: "user", parts: [{ text }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
    },
  })) as GenResp;
  const b64 = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!b64) throw new Error("No audio was returned. Please try again.");
  const pcm = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const rate = 24000;
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true);
  v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, pcm.length, true);
  const bytes = new Uint8Array(44 + pcm.length);
  bytes.set(new Uint8Array(header), 0);
  bytes.set(pcm, 44);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
