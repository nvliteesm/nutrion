import { cn } from "@/lib/cn";
import { progress as clampProgress } from "@/lib/nutrition";

interface ProgressBarProps {
  value: number;
  max: number;
  /** Tailwind background-color class for the fill, e.g. "bg-teal". */
  colorClass?: string;
  trackClass?: string;
  height?: number;
  className?: string;
}

export function ProgressBar({
  value,
  max,
  colorClass = "bg-teal",
  trackClass = "bg-line",
  height = 7,
  className,
}: ProgressBarProps) {
  const pct = clampProgress(value, max) * 100;
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full", trackClass, className)}
      style={{ height }}
    >
      <div
        className={cn("h-full rounded-full transition-[width]", colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
