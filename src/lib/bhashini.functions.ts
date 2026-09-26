import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { LANG_CODES } from "./languages";
import { bhashiniAsr, bhashiniTranslate, bhashiniTts } from "./bhashini.server";

const lang = z.string().refine((v) => LANG_CODES.includes(v), "Unsupported language");

export const speechToText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { audio: string; language: string }) =>
    z.object({ audio: z.string().min(100).max(4_000_000), language: lang }).parse(input),
  )
  .handler(async ({ data }) => {
    const text = await bhashiniAsr(data.audio, data.language);
    let english = text;
    if (text && data.language !== "en") {
      english = (await bhashiniTranslate([text], data.language, "en"))[0] ?? text;
    }
    return { text, english };
  });

export const translateTexts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { texts: string[]; target: string; source?: string }) =>
    z
      .object({
        texts: z.array(z.string().max(2000)).max(200),
        target: lang,
        source: lang.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const out: string[] = [];
    for (let i = 0; i < data.texts.length; i += 40) {
      out.push(
        ...(await bhashiniTranslate(data.texts.slice(i, i + 40), data.source ?? "en", data.target)),
      );
    }
    return { translations: out };
  });

export const textToSpeech = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; language: string }) =>
    z.object({ text: z.string().min(1).max(1500), language: lang }).parse(input),
  )
  .handler(async ({ data }) => {
    let text = data.text;
    if (data.language !== "en")
      text = (await bhashiniTranslate([text], "en", data.language))[0] ?? data.text;
    const audio = await bhashiniTts(text ?? data.text, data.language);
    if (!audio) throw new Error("No audio returned. Please try again.");
    return { audio };
  });
