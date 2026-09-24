import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileBarChart } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — BharatStandAI" },
      { name: "description", content: "Download standards reports for completed procurements." },
      { property: "og:title", content: "Reports — BharatStandAI" },
      { property: "og:description", content: "Review-ready Indian Standards reports for tenders." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("procurements")
        .select("id, title, category, created_at, summary")
        .eq("status", "Completed")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold">Reports</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review-ready standards reports for your completed procurements.
      </p>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : data?.length ? (
          data.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex min-w-0 gap-3">
                <FileBarChart className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-semibold">{p.title}</p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {p.summary ?? p.category}
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/procurement/$id" params={{ id: p.id }}>
                  Open report
                </Link>
              </Button>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No completed analyses yet.
          </p>
        )}
      </div>
    </div>
  );
}
