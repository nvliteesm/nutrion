import { cn } from "@/lib/cn";
import { progress as clampProgress } from "@/lib/nutrition";

interface ProgressRingProps {
  value: number;
  max: number;
  /** Pixel size. Omit to fill the parent via className (aspect-square). */
  size?: number;
  strokeWidth?: number;
  /** Tailwind text-color class for the arc, e.g. "text-teal". */
  colorClass?: string;
  trackClass?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Circular progress used for the calorie hero. The arc colour is driven by a
 * Tailwind text-color class via `stroke="currentColor"`.
 */
export function ProgressRing({
  value,
  max,
  size,
  strokeWidth = 11,
  colorClass = "text-teal",
  trackClass = "text-line",
  children,
  className,
}: ProgressRingProps) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const ratio = clampProgress(value, max);
  const dash = circumference * ratio;
  const fluid = size == null;

  return (
    <div
      className={cn("relative aspect-square", className)}
      style={fluid ? undefined : { width: size, height: size }}
    >
      <svg
        width={fluid ? "100%" : size}
        height={fluid ? "100%" : size}
        viewBox="0 0 120 120"
      >
        <circle
          className={trackClass}
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
        />
        <circle
          className={colorClass}
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform="rotate(-90 60 60)"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
