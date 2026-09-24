import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Layers, FileBarChart, ShieldCheck, ArrowRight } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — BharatStandAI" },
      {
        name: "description",
        content: "Track your procurements, identified Indian Standards and compliance reports.",
      },
      { property: "og:title", content: "BharatStandAI Dashboard" },
      {
        property: "og:description",
        content: "Track procurements and recommended Indian Standards in one place.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: profile } = useProfile();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [{ data: procurements }, { count: recoCount }] = await Promise.all([
        supabase
          .from("procurements")
          .select("id, title, category, status, created_at")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("recommendations").select("id", { count: "exact", head: true }),
      ]);
      const { count: total } = await supabase
        .from("procurements")
        .select("id", { count: "exact", head: true });
      const { count: completed } = await supabase
        .from("procurements")
        .select("id", { count: "exact", head: true })
        .eq("status", "Completed");
      return {
        recent: procurements ?? [],
        standards: recoCount ?? 0,
        total: total ?? 0,
        reports: completed ?? 0,
        compliance: total ? Math.round(((completed ?? 0) / total) * 100) : 100,
      };
    },
  });

  const cards = [
    { label: "Total Procurements", value: data?.total ?? 0, icon: FileText, tone: "text-primary" },
    { label: "Standards Identified", value: data?.standards ?? 0, icon: Layers, tone: "text-info" },
    { label: "Reports Generated", value: data?.reports ?? 0, icon: FileBarChart, tone: "text-saffron" },
    {
      label: "Compliance Rate",
      value: `${data?.compliance ?? 100}%`,
      icon: ShieldCheck,
      tone: "text-success",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome back, {profile?.full_name}! Here's what's happening with your procurements.
          </p>
        </div>
        <Button asChild>
          <Link to="/new-procurement">New Procurement</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5 shadow-card">
            <Icon className={`h-5 w-5 ${tone}`} />
            <p className="mt-4 text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-base font-semibold">Recent Procurements</h2>
          <Link
            to="/history"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {isLoading ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data?.recent.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-3 font-medium">Title</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/40">
                    <td className="px-5 py-3 font-medium">
                      <Link to="/procurement/$id" params={{ id: p.id }} className="hover:underline">
                        {p.title}
                      </Link>
                    </td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-sm text-muted-foreground">
              No procurements yet. Create your first one to get standard recommendations.
            </p>
            <Button asChild className="mt-4">
              <Link to="/new-procurement">Start a procurement</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
