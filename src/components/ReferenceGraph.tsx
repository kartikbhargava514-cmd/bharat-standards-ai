import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, GitBranch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const RELATION_LABELS: Record<string, string> = {
  normative_reference: "Normative Reference",
  informative_reference: "Informative Reference",
  test_method: "Test Method",
  safety_reference: "Safety",
  terminology: "Terminology",
  installation_reference: "Installation",
  component_reference: "Component",
  related_product: "Related Product Standard",
  supersedes: "Supersedes",
  replaced_by: "Replaced By",
};

type Edge = {
  root_id: string;
  depth: number;
  parent_id: string;
  relation_type: string;
  target_is_number: string;
  target_id: string | null;
  target_title: string | null;
  target_status: string | null;
};

export function useReferenceGraph(rootIds: string[], depth = 3) {
  return useQuery({
    queryKey: ["standard-graph", [...rootIds].sort().join(","), depth],
    enabled: rootIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("standard_graph", {
        _root_ids: rootIds,
        _max_depth: depth,
      });
      if (error) throw error;
      return (data ?? []) as Edge[];
    },
  });
}

function Node({
  edge,
  edges,
  rootId,
  level,
}: {
  edge: Edge;
  edges: Edge[];
  rootId: string;
  level: number;
}) {
  const children = edge.target_id
    ? edges.filter(
        (e) => e.root_id === rootId && e.parent_id === edge.target_id && e.depth === level + 1,
      )
    : [];
  const [open, setOpen] = useState(level < 1);
  return (
    <li>
      <div className="flex flex-wrap items-center gap-2 py-1 text-sm">
        {children.length ? (
          <button onClick={() => setOpen(!open)} className="text-muted-foreground" aria-label="Toggle">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4 text-muted-foreground">→</span>
        )}
        {edge.target_id ? (
          <Link
            to="/standards/$id"
            params={{ id: edge.target_id }}
            className="font-semibold text-primary hover:underline"
          >
            {edge.target_is_number}
          </Link>
        ) : (
          <span className="font-semibold">{edge.target_is_number}</span>
        )}
        <span className="rounded bg-secondary/15 px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
          {RELATION_LABELS[edge.relation_type] ?? edge.relation_type}
        </span>
        {edge.target_title && (
          <span className="text-xs text-muted-foreground">{edge.target_title}</span>
        )}
        {edge.target_status && edge.target_status !== "Current" && (
          <span className="text-[11px] font-semibold text-destructive">{edge.target_status}</span>
        )}
      </div>
      {open && children.length > 0 && (
        <ul className="ml-5 border-l border-border pl-3">
          {children.map((c, i) => (
            <Node key={i} edge={c} edges={edges} rootId={rootId} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ReferenceTree({
  rootId,
  edges,
  compact,
}: {
  rootId: string;
  edges: Edge[];
  compact?: boolean;
}) {
  const top = edges.filter((e) => e.root_id === rootId && e.depth === 1);
  if (!top.length)
    return <p className="text-sm text-muted-foreground">No reference relationships recorded.</p>;
  return (
    <ul className={cn(compact ? "" : "mt-1")}>
      {top.map((e, i) => (
        <Node key={i} edge={e} edges={edges} rootId={rootId} level={1} />
      ))}
    </ul>
  );
}

export function PrimaryReferenceCard({
  rootId,
  isNumber,
  edges,
}: {
  rootId: string;
  isNumber: string;
  edges: Edge[];
}) {
  const [open, setOpen] = useState(true);
  const count = edges.filter((e) => e.root_id === rootId).length;
  return (
    <div className="rounded-lg border border-border p-4">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <GitBranch className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Primary Standard
        </span>
        <span className="font-display font-bold text-primary">{isNumber}</span>
        <span className="ml-auto text-xs text-muted-foreground">{count} linked</span>
      </button>
      {open && (
        <div className="mt-2 pl-6">
          <ReferenceTree rootId={rootId} edges={edges} compact />
        </div>
      )}
    </div>
  );
}
