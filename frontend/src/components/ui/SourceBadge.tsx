import { cn } from "@/lib/cn";
import type { DataSource } from "@/lib/types";
import { Badge, type BadgeTone } from "./Badge";

const config: Record<DataSource, { label: string; tone: BadgeTone }> = {
  label: { label: "Label", tone: "teal" },
  manual: { label: "Manual", tone: "neutral" },
  database: { label: "Database", tone: "blue" },
  ai: { label: "AI estimate", tone: "amber" },
};

/** Clearly labels where an entry's numbers came from (product rule 11). */
export function SourceBadge({
  source,
  className,
}: {
  source: DataSource;
  className?: string;
}) {
  const { label, tone } = config[source];
  return (
    <Badge tone={tone} className={cn("uppercase tracking-wide", className)}>
      {label}
    </Badge>
  );
}
