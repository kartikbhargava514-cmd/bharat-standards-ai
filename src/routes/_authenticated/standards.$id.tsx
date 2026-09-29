import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Download, Gauge, ShieldCheck, Link2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/standards/$id")({
  head: () => ({
    meta: [
      { title: "Standard details — BharatStandAI" },
      {
        name: "description",
        content: "Scope, key parameters, certification and related Indian Standards.",
      },
      { property: "og:title", content: "Indian Standard details — BharatStandAI" },
      { property: "og:description", content: "Full details of the selected Indian Standard." },
    ],
  }),
  component: StandardDetail,
});

function StandardDetail() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["standard", id],
    queryFn: async () => {
      const { data } = await supabase.from("standards").select("*").eq("id", id).maybeSingle();
      if (!data) return null;
      const { data: related } = await supabase
        .from("standards")
        .select("id, is_number, title")
        .in("is_number", data.related_standards.length ? data.related_standards : ["__none__"]);
      return { standard: data, related: related ?? [] };
    },
  });

  if (isLoading) return <Skeleton className="mx-auto h-96 max-w-4xl" />;
  if (!data)
    return (
      <p className="mx-auto max-w-4xl text-sm text-muted-foreground">Standard not found.</p>
    );

  const s = data.standard;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print flex items-center justify-between">
        <Link
          to="/standards"
          search={{ q: "" }}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Standards
        </Link>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Download className="mr-2 h-4 w-4" /> Download PDF
        </Button>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-card p-6 shadow-card">
        <h1 className="font-display text-2xl font-bold">{s.is_number}</h1>
        <p className="mt-1 text-muted-foreground">{s.title}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CategoryBadge category={s.standard_type} />
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
            {s.category}
          </span>
          <span className="rounded-md bg-success/12 px-2 py-1 text-xs font-semibold text-success">
            BIS
          </span>
          <span
            className={`rounded-md px-2 py-1 text-xs font-semibold ${
              s.status === "Current"
                ? "bg-success/12 text-success"
                : "bg-warning/20 text-warning-foreground"
            }`}
          >
            {s.status}
          </span>
        </div>

        <Section icon={BookOpen} title="Scope">
          <p className="text-sm text-muted-foreground">{s.scope}</p>
        </Section>

        <Section icon={Gauge} title="Key Parameters">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {s.key_parameters.length ? (
              s.key_parameters.map((p) => <li key={p}>{p}</li>)
            ) : (
              <li>Refer to the published standard for detailed parameters.</li>
            )}
          </ul>
        </Section>

        <Section icon={ShieldCheck} title="Applicable For / Certification">
          <p className="text-sm text-muted-foreground">{s.applicable_for ?? "—"}</p>
          <p className="mt-2 text-sm font-medium">
            {s.certification ?? "No mandatory certification recorded for this standard."}
          </p>
          {s.latest_amendment && (
            <p className="mt-2 text-sm text-muted-foreground">
              Latest amendment: <span className="font-medium">{s.latest_amendment}</span>
            </p>
          )}
        </Section>

        <Section icon={Link2} title="Normative Reference Graph">
          <GraphTree id={s.id} />
        </Section>

        <Section icon={Link2} title="Related / Normative Standards">
          <div className="flex flex-wrap gap-2">
            {s.related_standards.length ? (
              s.related_standards.map((num) => {
                const match = data.related.find((r) => r.is_number === num);
                return match ? (
                  <Link
                    key={num}
                    to="/standards/$id"
                    params={{ id: match.id }}
                    className="rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
                  >
                    {num}
                  </Link>
                ) : (
                  <span
                    key={num}
                    className="rounded-md bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    {num}
                  </span>
                );
              })
            ) : (
              <span className="text-sm text-muted-foreground">None recorded.</span>
            )}
          </div>
        </Section>

        <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
          Source: BIS metadata ({s.source_url ?? "www.services.bis.gov.in"}). This information
          assists review and is not a legal determination of applicability.
        </p>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 flex gap-3 border-t border-border pt-5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
