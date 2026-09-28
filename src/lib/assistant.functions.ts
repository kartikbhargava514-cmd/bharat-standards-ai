import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { awaitAi } from "./ai-errors";
import { CHAT_MODEL, openaiOptions, openaiProvider } from "./openai.server";

const SYSTEM = `You are "Mitra", the BharatStandAI assistant for Indian government procurement officers.
You help with two things:
1) Explaining Indian Standards (IS). When a user asks about a standard, answer in clear markdown with these headed sections, using bullet points:
   **What it covers**, **Why it is important**, **Use and relevance in procurement**, **Why this standard and not others** (compare with related/alternative standards from the catalogue), **Certification** (BIS ISI mark, CRS, QCO, hallmarking where applicable), **What else you can do with it / where it can be used**.
2) Guiding users through the app: Dashboard (choose Manual Form, Text/Word File Upload, Voice, or Camera input), New Procurement (fill title, description, quantity, unit, use; missing details prompt lets you fill, accept anyway, reject or withdraw), AI analysis report (recommended standards with relevance %, evidence, alerts, Accept/Reject/Withdraw, Listen, Export PDF), Standards Search (search by number/keyword/category, open detail), History, Reports, Settings, language switcher at the top.
Rules: Prefer standards from the supplied catalogue; if a standard is not in it, say so and do not invent details or numbers. Never give legal determinations — you assist the officer's review. Reply in the user's language. Keep answers focused and practical.`;

export const sendAssistantMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { threadId?: string | null; message: string }) =>
    z
      .object({ threadId: z.string().uuid().nullish(), message: z.string().trim().min(1).max(4000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let threadId = data.threadId ?? null;

    if (threadId) {
      const { data: t } = await supabase.from("chat_threads").select("id").eq("id", threadId).maybeSingle();
      if (!t) throw new Error("Conversation not found.");
    } else {
      const { data: t, error } = await supabase
        .from("chat_threads")
        .insert({ user_id: userId, title: data.message.slice(0, 60) })
        .select("id")
        .single();
      if (error || !t) throw new Error("Could not start a conversation.");
      threadId = t.id;
    }

    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("thread_id", threadId)
      .order("created_at")
      .limit(40);

    const { error: uErr } = await supabase
      .from("chat_messages")
      .insert({ thread_id: threadId, user_id: userId, role: "user", content: data.message });
    if (uErr) throw new Error("Could not save your message.");

    const { data: standards } = await supabase
      .from("standards")
      .select("is_number, title, scope, category, status, latest_amendment, certification, related_standards");

    let streamError: unknown = null;
    const result = streamText({
      model: openaiProvider().responses(CHAT_MODEL),
      maxRetries: 0,
      onError: ({ error }) => {
        streamError = error;
      },
      system: `${SYSTEM}\n\nCATALOGUE (JSON):\n${JSON.stringify(standards ?? [])}`,
      messages: [
        ...(history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: data.message },
      ],
      providerOptions: openaiOptions,
    });
    const reply = (await awaitAi(result.text, () => streamError)).trim();

    const { error: aErr } = await supabase
      .from("chat_messages")
      .insert({ thread_id: threadId, user_id: userId, role: "assistant", content: reply });
    if (aErr) console.error("save assistant msg", aErr);
    await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);

    return { threadId, reply };
  });
