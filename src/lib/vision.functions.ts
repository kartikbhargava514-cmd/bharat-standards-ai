import { createServerFn } from "@tanstack/react-start";
import { createOpenAI } from "@ai-sdk/openai";
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
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");
    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    let streamError: unknown = null;
    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
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
    const text = await awaitAi(result.text, () => streamError);
    return { text: text.trim() };
  });
