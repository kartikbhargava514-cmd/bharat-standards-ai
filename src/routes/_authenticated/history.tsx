import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Procurement History — BharatStandAI" },
      { name: "description", content: "View and manage your past procurements and reports." },
      { property: "og:title", content: "Procurement History — BharatStandAI" },
      { property: "og:description", content: "All past procurements and their recommended standards." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("procurements")
        .select("id, ref_no, title, category, status, created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-bold">Procurement History</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        View and manage your past procurements and reports.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-card">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Ref. No.</th>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-5 py-3 font-mono text-xs whitespace-nowrap">{p.ref_no}</td>
                    <td className="px-5 py-3 font-medium">{p.title}</td>
                    <td className="px-5 py-3 text-muted-foreground">{p.category ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        to="/procurement/$id"
                        params={{ id: p.id }}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">No procurements yet.</p>
            <Button asChild className="mt-4">
              <Link to="/new-procurement">Create one</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
