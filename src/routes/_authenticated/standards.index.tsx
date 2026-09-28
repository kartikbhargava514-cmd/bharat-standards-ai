import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssistantChat } from "@/components/AssistantChat";
import { CategoryBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/standards/")({
  validateSearch: (search: Record<string, unknown>): { q: string; chat?: string } => ({
    q: String(search["q"] ?? ""),
    ...(typeof search["chat"] === "string" ? { chat: search["chat"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Standards Search — BharatStandAI" },
      {
        name: "description",
        content: "Search Indian Standards by number, keyword, category or product.",
      },
      { property: "og:title", content: "Standards Search — BharatStandAI" },
      { property: "og:description", content: "Browse the curated Indian Standards knowledge base." },
    ],
  }),
  component: StandardsSearch,
});

const popular = ["steel", "electrical", "cement", "plastic", "medical equipment", "construction"];

function StandardsSearch() {
  const { q, chat } = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(q);
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [year, setYear] = useState("all");

  const { data: categories } = useQuery({
    queryKey: ["standard-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("standards").select("category, standard_type");
      return {
        categories: [...new Set((data ?? []).map((d) => d.category))].sort(),
        types: [...new Set((data ?? []).map((d) => d.standard_type))].sort(),
      };
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["standards", q, category, type, year],
    queryFn: async () => {
      let query = supabase.from("standards").select("*").order("is_number");
      if (q.trim()) {
        const safe = q.trim().replace(/[%,()]/g, " ");
        query = query.or(
          `is_number.ilike.%${safe}%,title.ilike.%${safe}%,scope.ilike.%${safe}%,category.ilike.%${safe}%`,
        );
      }
      if (category !== "all") query = query.eq("category", category);
      if (type !== "all") query = query.eq("standard_type", type);
      if (year !== "all") query = query.gte("year", Number(year));
      const { data } = await query;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold">Search Indian Standards</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Search by standard number, keyword, category or product.
      </p>

      <div className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/standards", search: { q: term } });
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g. IS 277, steel, roofing, electrical..."
              className="pl-9"
              maxLength={100}
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Standard Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {categories?.types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                <SelectItem value="2015">2015 and newer</SelectItem>
                <SelectItem value="2005">2005 and newer</SelectItem>
                <SelectItem value="1990">1990 and newer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold">Popular Searches</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {popular.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setTerm(p);
                  navigate({ to: "/standards", search: { q: p } });
                }}
                className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 font-display text-base font-semibold">Ask Mitra about any standard</h2>
        <AssistantChat
          threadId={chat ?? null}
          onThreadChange={(id) => navigate({ to: "/standards", search: id ? { q, chat: id } : { q } })}
          suggestions={["Explain IS 277 in detail", "Why use IS 1786 for steel bars and not others?", "Which standards apply to PVC pipes?", "Where else can IS 269 cement be used?"]}
        />
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : data?.length ? (
          data.map((s) => (
            <Link
              key={s.id}
              to="/standards/$id"
              params={{ id: s.id }}
              className="block rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-lift"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display font-bold text-primary">{s.is_number}</p>
                <CategoryBadge category={s.standard_type} />
                {s.status !== "Current" && (
                  <span className="rounded-md bg-warning/20 px-2 py-1 text-xs font-semibold text-warning-foreground">
                    {s.status}
                  </span>
                )}
              </div>
              <p className="mt-1 font-semibold">{s.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.scope}</p>
            </Link>
          ))
        ) : (
          <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No standards matched your search.
          </p>
        )}
      </div>
    </div>
  );
}
