import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "navy" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-teal text-white shadow-[0_4px_12px_rgba(18,184,134,0.3)] hover:bg-teal-d",
  navy: "bg-navy text-white hover:bg-navy-2",
  outline:
    "border border-line-2 bg-transparent text-ink hover:bg-app-bg",
  ghost: "bg-transparent text-ink-2 hover:bg-app-bg",
};

const sizes: Record<Size, string> = {
  sm: "px-3.5 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-card-sm font-bold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
