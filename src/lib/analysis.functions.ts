import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output } from "ai";
import { z } from "zod";

const AnalysisSchema = z.object({
  product_category: z.string(),
  material: z.string(),
  key_properties: z.array(z.string()),
  usage: z.string(),
  quantity: z.string(),
  technical_requirements: z.array(z.string()),
  summary: z.string(),
  recommendations: z.array(
    z.object({
      is_number: z.string(),
      category: z.string(),
      relevance: z.number(),
      reason: z.string(),
      evidence: z.string(),
    }),
  ),
  alerts: z.array(
    z.object({
      level: z.string(),
      title: z.string(),
      message: z.string(),
    }),
  ),
  certification: z.string(),
});

export const analyzeProcurement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { procurementId: string }) =>
    z.object({ procurementId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project.");

    const { supabase, userId } = context;

    const { data: procurement, error: procError } = await supabase
      .from("procurements")
      .select("*")
      .eq("id", data.procurementId)
      .single();
    if (procError || !procurement) throw new Error("Procurement not found.");

    const { data: standards, error: stdError } = await supabase
      .from("standards")
      .select(
        "id, is_number, title, scope, category, standard_type, status, latest_amendment, certification, related_standards, keywords",
      );
    if (stdError) throw stdError;

    const catalogue = (standards ?? []).map((s) => ({
      is_number: s.is_number,
      title: s.title,
      scope: s.scope,
      category: s.category,
      type: s.standard_type,
      status: s.status,
      amendment: s.latest_amendment,
      certification: s.certification,
      related: s.related_standards,
      keywords: s.keywords,
    }));

    const runtimeFetch = async (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init);

    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runtimeFetch,
    });

    const input = [
      `Procurement title: ${procurement.title}`,
      `Description / specification: ${procurement.description}`,
      procurement.quantity ? `Quantity: ${procurement.quantity} ${procurement.unit ?? ""}` : "",
      procurement.application ? `Application / use: ${procurement.application}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const result = streamText({
      model: lovable.responses("openai/gpt-6-astra"),
      output: Output.object({ schema: AnalysisSchema }),
      system: [
        "You are BharatStandAI, an assistant for Indian government procurement officials.",
        "You semantically analyse a procurement specification and recommend applicable Indian Standards (IS).",
        "You may ONLY recommend standards whose is_number appears in the supplied catalogue. Never invent standard numbers.",
        "Input may be in any Indian language or English; always reply in English.",
        "For each recommendation set category to exactly one of: Core Standard, Related Standard, Testing Standard, Safety Standard, Installation Standard, Terminology Standard, Normative Reference.",
        "relevance is an integer 0-100 reflecting semantic fit. Return 4 to 8 recommendations ordered by relevance.",
        "reason: one sentence on why the standard applies to this procurement. evidence: quote the catalogue scope text that supports it.",
        "alerts: flag superseded/old editions, missing requirements, and safety considerations. level must be 'warning', 'info' or 'success'.",
        "certification: a short note on mandatory certification (BIS ISI mark, CRS registration, QCO, hallmarking) where applicable.",
        "Never claim legal determination; this assists the officer's review.",
      ].join(" "),
      prompt: `CATALOGUE OF AVAILABLE INDIAN STANDARDS (JSON):\n${JSON.stringify(catalogue)}\n\nPROCUREMENT INPUT:\n${input}`,
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

    const analysis = await result.output;

    const byNumber = new Map((standards ?? []).map((s) => [s.is_number, s]));

    await supabase
      .from("procurements")
      .update({
        structured_requirements: {
          product_category: analysis.product_category,
          material: analysis.material,
          key_properties: analysis.key_properties,
          usage: analysis.usage,
          quantity: analysis.quantity,
          technical_requirements: analysis.technical_requirements,
          certification: analysis.certification,
        },
        summary: analysis.summary,
        alerts: analysis.alerts,
        category: analysis.product_category,
        status: "Completed",
      })
      .eq("id", procurement.id);

    await supabase.from("recommendations").delete().eq("procurement_id", procurement.id);

    const rows = analysis.recommendations
      .filter((r) => byNumber.has(r.is_number))
      .map((r) => {
        const std = byNumber.get(r.is_number)!;
        return {
          procurement_id: procurement.id,
          user_id: userId,
          standard_id: std.id,
          is_number: std.is_number,
          title: std.title,
          category: r.category,
          relevance: Math.max(0, Math.min(100, Math.round(r.relevance))),
          reason: r.reason,
          evidence: r.evidence,
        };
      });

    if (rows.length) {
      const { error: insertError } = await supabase.from("recommendations").insert(rows);
      if (insertError) throw insertError;
    }

    return { ok: true, count: rows.length };
  });
