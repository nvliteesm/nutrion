import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-card-sm border border-line-2 bg-white px-3.5 py-3 text-sm font-semibold text-ink",
          "placeholder:font-medium placeholder:text-ink-3",
          "focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);
