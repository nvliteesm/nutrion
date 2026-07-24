import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone =
  | "teal"
  | "blue"
  | "amber"
  | "red"
  | "navy"
  | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const tones: Record<BadgeTone, string> = {
  teal: "bg-teal-t text-teal-d",
  blue: "bg-blue-t text-blue-d",
  amber: "bg-amber-t text-amber-d",
  red: "bg-red-t text-red-d",
  navy: "bg-navy text-white",
  neutral: "bg-navy/[0.07] text-ink-2",
};

/** Small rounded pill used for statuses, sources, confidence, etc. */
export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold leading-none",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
