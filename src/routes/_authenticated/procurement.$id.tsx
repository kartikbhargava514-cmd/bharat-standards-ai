import { Check, X, Undo2 } from "lucide-react";
import { SpeakButton } from "@/components/LanguageTools";
import { PrimaryReferenceCard, useReferenceGraph } from "@/components/ReferenceGraph";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  FileText,
  Info,
  Package,
  Printer,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { analyzeProcurement } from "@/lib/analysis.functions";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/procurement/$id")({
  head: () => ({
    meta: [
      { title: "Procurement analysis — BharatStandAI" },
      {
        name: "description",
        content: "AI understanding, recommended Indian Standards, alerts and the final report.",
      },
      { property: "og:title", content: "Procurement analysis — BharatStandAI" },
      {
        property: "og:description",
        content: "Recommended Indian Standards with reasons, evidence and certification notes.",
      },
    ],
  }),
  component: ProcurementPage,
});

type Requirements = {
  product_category?: string;
  material?: string;
  key_properties?: string[];
  usage?: string;
  quantity?: string;
  technical_requirements?: string[];
  certification?: string;
};
type Alert = { level: string; title: string; message: string };

const steps = [
  "Understanding Requirement",
  "Extracting Key Details",
  "Finding Relevant Standards",
  "Preparing Recommendations",
];

const filters = ["All", "Core", "Related", "Testing", "Safety"] as const;

function ReviewActions({ id, status }: { id: string; status: string }) {
  const queryClient = useQueryClient();
  const review = useMutation({
    mutationFn: async (next: "Accepted" | "Rejected" | "Withdrawn") => {
      const note =
        next === "Accepted" ? null : window.prompt(`Reason for marking ${next.toLowerCase()} (optional):`) ?? null;
      const { error } = await supabase
        .from("procurements")
        .update({ status: next, review_note: note, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return next;
    },
    onSuccess: async (next) => {
      await queryClient.invalidateQueries({ queryKey: ["procurement", id] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Report ${next.toLowerCase()}.`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update."),
  });
  if (["Accepted", "Rejected", "Withdrawn"].includes(status))
    return <span className="self-center text-sm font-semibold">Report {status}</span>;
  return (
    <>
      <Button size="sm" disabled={review.isPending} onClick={() => review.mutate("Accepted")}>
        <Check className="mr-2 h-4 w-4" /> Accept
      </Button>
      <Button size="sm" variant="destructive" disabled={review.isPending} onClick={() => review.mutate("Rejected")}>
        <X className="mr-2 h-4 w-4" /> Reject
      </Button>
      <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate("Withdrawn")}>
        <Undo2 className="mr-2 h-4 w-4" /> Withdraw
      </Button>
    </>
  );
}

function GraphSection({
  recos,
}: {
  recos: { standard_id: string | null; is_number: string; category: string }[];
}) {
  const primaries = recos.filter((r) => r.standard_id && /core/i.test(r.category));
  const list = (primaries.length ? primaries : recos.filter((r) => r.standard_id).slice(0, 2)) as {
    standard_id: string;
    is_number: string;
  }[];
  const { data: edges = [] } = useReferenceGraph(list.map((r) => r.standard_id));
  if (!list.length) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-card">
      <h2 className="font-display text-lg font-bold">Normative Reference Graph</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Allied standards linked to each primary standard (normative, test method, safety,
        terminology, installation and more).
      </p>
      <div className="mt-4 space-y-3">
        {list.map((r) => (
          <PrimaryReferenceCard key={r.standard_id} rootId={r.standard_id} isNumber={r.is_number} edges={edges} />
        ))}
      </div>
    </section>
  );
}

function ProcurementPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: profile } = useProfile();
  const analyze = useServerFn(analyzeProcurement);
  const [step, setStep] = useState(0);
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");

  const { data, isLoading } = useQuery({
    queryKey: ["procurement", id],
    queryFn: async () => {
      const { data: procurement } = await supabase
        .from("procurements")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      const { data: recos } = await supabase
        .from("recommendations")
        .select("*")
        .eq("procurement_id", id)
        .order("relevance", { ascending: false });
      return { procurement, recos: recos ?? [] };
    },
  });

  const mutation = useMutation({
    mutationFn: async () => analyze({ data: { procurementId: id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["procurement", id] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Analysis complete.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Analysis failed. Please try again."),
  });

  const needsAnalysis =
    !!data?.procurement && !["Completed", "Accepted", "Rejected", "Withdrawn"].includes(data.procurement.status) && data.recos.length === 0;

  useEffect(() => {
    if (needsAnalysis && mutation.isIdle) mutation.mutate();
  }, [needsAnalysis, mutation]);

  useEffect(() => {
    if (!mutation.isPending) return;
    setStep(0);
    const timer = setInterval(() => setStep((s) => (s < steps.length - 1 ? s + 1 : s)), 4000);
    return () => clearInterval(timer);
  }, [mutation.isPending]);

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-5xl" />;
  if (!data?.procurement)
    return <p className="mx-auto max-w-5xl text-sm text-muted-foreground">Procurement not found.</p>;

  const p = data.procurement;
  const req = (p.structured_requirements ?? {}) as Requirements;
  const alerts = (p.alerts ?? []) as Alert[];

  if (mutation.isPending) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-8 shadow-card">
        <h1 className="font-display text-xl font-bold">AI is analyzing your procurement...</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Our AI is understanding your requirements and extracting key details from your input and
          document (if any).
        </p>
        <div className="mt-8 grid grid-cols-4 gap-2">
          {steps.map((s, i) => (
            <div key={s} className="text-center">
              <div
                className={cn(
                  "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                  i <= step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {i + 1}
              </div>
              <p className="mt-2 text-[11px] leading-tight text-muted-foreground">{s}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center">
          <div className="flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-primary/10">
            <BrainCircuit className="h-9 w-9 text-primary" />
          </div>
          <p className="mt-4 font-semibold">Analyzing...</p>
          <p className="text-sm text-muted-foreground">This may take a few moments.</p>
        </div>
      </div>
    );
  }

  const visible = data.recos.filter((r) =>
    filter === "All" ? true : r.category.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/history"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to History
        </Link>
        <div className="flex flex-wrap gap-2">
          <ReviewActions id={id} status={p.status} />
          <SpeakButton text={p.summary ?? p.description} />
          <Button variant="outline" size="sm" onClick={() => mutation.mutate()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Re-analyze
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      {/* AI understanding */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">AI Understanding</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We have extracted the following information from your input.
        </p>

        <div className="mt-4 flex items-center gap-3 rounded-lg bg-muted/60 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Product Category</p>
            <p className="font-semibold">{req.product_category ?? p.category ?? "—"}</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="font-semibold">Extracted Requirements</p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Material:</span> {req.material ?? "—"}
            </li>
            <li>
              <span className="font-semibold text-foreground">Key Properties:</span>{" "}
              {req.key_properties?.join(", ") || "—"}
            </li>
            <li>
              <span className="font-semibold text-foreground">Usage:</span> {req.usage ?? "—"}
            </li>
            <li>
              <span className="font-semibold text-foreground">Quantity:</span>{" "}
              {req.quantity || `${p.quantity ?? "—"} ${p.unit ?? ""}`}
            </li>
            {req.technical_requirements?.length ? (
              <li>
                <span className="font-semibold text-foreground">Technical requirements:</span>{" "}
                {req.technical_requirements.join("; ")}
              </li>
            ) : null}
          </ul>
        </div>

        {req.certification && (
          <div className="mt-5 flex gap-3 rounded-lg border border-success/30 bg-success/8 p-4">
            <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="text-sm font-semibold">Certification Requirements</p>
              <p className="text-sm text-muted-foreground">{req.certification}</p>
            </div>
          </div>
        )}
      </section>

      {/* Recommendations */}
      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="font-display text-lg font-bold">Recommended Indian Standards</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Based on your requirements, here are the most relevant Indian Standards.
        </p>

        <div className="no-print mt-4 flex flex-wrap gap-2">
          {filters.map((f) => {
            const count =
              f === "All"
                ? data.recos.length
                : data.recos.filter((r) => r.category.toLowerCase().includes(f.toLowerCase()))
                    .length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                {f} ({count})
              </button>
            );
          })}
        </div>

        <div className="mt-5 space-y-4">
          {visible.length ? (
            visible.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.standard_id ? (
                        <Link
                          to="/standards/$id"
                          params={{ id: r.standard_id }}
                          className="font-display font-bold text-primary hover:underline"
                        >
                          {r.is_number}
                        </Link>
                      ) : (
                        <span className="font-display font-bold text-primary">{r.is_number}</span>
                      )}
                      <CategoryBadge category={r.category} />
                    </div>
                    <p className="mt-1 text-sm font-medium">{r.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-muted-foreground">Relevance</p>
                    <p className="font-display font-bold text-success">{r.relevance}%</p>
                  </div>
                </div>
                <p className="mt-3 text-sm">
                  <span className="font-semibold">Why recommended: </span>
                  <span className="text-muted-foreground">{r.reason}</span>
                </p>
                {r.evidence && (
                  <p className="mt-2 border-l-2 border-primary/30 pl-3 text-xs text-muted-foreground italic">
                    Evidence: {r.evidence}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No standards in this category.</p>
          )}
        </div>
      </section>

      <GraphSection recos={data.recos} />

      {/* Alerts */}
      {alerts.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="font-display text-lg font-bold">Alerts &amp; Suggestions</h2>
          <div className="mt-4 space-y-3">
            {alerts.map((a, i) => {
              const Icon =
                a.level === "warning" ? AlertTriangle : a.level === "success" ? CheckCircle2 : Info;
              const tone =
                a.level === "warning"
                  ? "border-warning/40 bg-warning/10 text-warning-foreground"
                  : a.level === "success"
                    ? "border-success/30 bg-success/8 text-success"
                    : "border-info/30 bg-info/8 text-info";
              return (
                <div key={i} className={cn("flex gap-3 rounded-lg border p-4", tone)}>
                  <Icon className="h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-sm text-muted-foreground">{a.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Report preview */}
      <section className="rounded-xl border border-border bg-card p-8 shadow-card">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h2 className="font-display text-lg font-bold">Procurement Standards Report</h2>
            <p className="text-xs text-muted-foreground">
              AI Powered Indian Standards Recommendation — BharatStandAI
            </p>
          </div>
        </div>

        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Procurement Title" value={p.title} />
          <Row
            label="Date"
            value={new Date(p.created_at).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          />
          <Row label="Category" value={req.product_category ?? p.category ?? "—"} />
          <Row label="Quantity" value={`${p.quantity ?? "—"} ${p.unit ?? ""}`} />
          <Row label="Prepared by" value={profile?.full_name ?? "—"} />
          <Row label="Department" value={profile?.department ?? "—"} />
        </dl>

        <h3 className="mt-6 font-display text-base font-semibold">1. Executive Summary</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {p.summary ?? "Analysis summary will appear here after the AI review."}
        </p>

        <h3 className="mt-6 font-display text-base font-semibold">2. Recommended Standards</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">S.No</th>
                <th className="px-3 py-2 font-medium">Standard No.</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Relevance</th>
              </tr>
            </thead>
            <tbody>
              {data.recos.map((r, i) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.is_number}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.category}</td>
                  <td className="px-3 py-2">{r.relevance}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
          This report assists the procurement official's review. It is not a legal determination of
          applicability. Always verify the latest published edition with BIS.
        </p>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="font-medium">: {value}</dd>
    </div>
  );
}
