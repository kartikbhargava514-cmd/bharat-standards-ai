import { createServerFn } from "@tanstack/react-start";
import { CHAT_MODEL, openaiOptions, openaiProvider } from "./openai.server";
import { streamText } from "ai";
import { awaitAi } from "./ai-errors";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const extractFromImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string; mediaType: string }) =>
    z
      .object({
        image: z.string().min(100).max(6_000_000),
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const lovable = openaiProvider();
    let streamError: unknown = null;
    const result = streamText({
      model: lovable.responses(CHAT_MODEL),
      maxRetries: 0,
      onError: ({ error }) => {
        streamError = error;
      },
      system:
        "You read photos of products, labels, spec sheets or tender pages for Indian procurement officers. Transcribe and summarise in English every procurement-relevant detail visible: product name, material, grade, dimensions, ratings, quantities, markings (ISI/IS numbers), and intended use. Plain text, max 200 words. If nothing relevant is visible, say so briefly.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the procurement specification from this image." },
            { type: "file", data: data.image, mediaType: data.mediaType },
          ],
        },
      ],
      providerOptions: openaiOptions,
    });
    const text = await awaitAi(result.text, () => streamError);
    return { text: text.trim() };
  });

export const generateFormalTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string }) =>
    z.object({ text: z.string().min(3).max(6000) }).parse(input),
  )
  .handler(async ({ data }) => {
    let streamError: unknown = null;
    const result = streamText({
      model: openaiProvider().responses(CHAT_MODEL),
      maxRetries: 0,
      onError: ({ error }) => {
        streamError = error;
      },
      system:
        "Write a formal government procurement title (in English, Title Case, 4-10 words, no quotes, no trailing period) for the item described. Example: 'Supply of Galvanized Corrugated Roofing Sheets for Government Warehouse'. Reply with the title only.",
      prompt: data.text,
      providerOptions: openaiOptions,
    });
    const title = await awaitAi(result.text, () => streamError);
    return { title: title.trim().replace(/^["']|["'.]$/g, "").slice(0, 160) };
  });
