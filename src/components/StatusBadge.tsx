import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Completed"
      ? "bg-success/12 text-success"
      : status === "Failed"
        ? "bg-destructive/12 text-destructive"
        : "bg-info/12 text-info";
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", tone)}>{status}</span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const tone = category.includes("Core")
    ? "bg-primary/10 text-primary"
    : category.includes("Testing")
      ? "bg-info/12 text-info"
      : category.includes("Safety")
        ? "bg-destructive/10 text-destructive"
        : category.includes("Installation")
          ? "bg-saffron/20 text-saffron-foreground"
          : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", tone)}>{category}</span>
  );
}
