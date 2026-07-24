import { cn } from "@/lib/cn";

/** Shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-card-lg bg-ink/[0.06]", className)}
      aria-hidden="true"
    />
  );
}
