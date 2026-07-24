"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

/** Shared bottom/center sheet chrome used by profile & log popups. */
export function Sheet({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    window.scrollTo(0, 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-navy-ink/45"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex max-h-[min(88dvh,720px)] w-full max-w-[440px] flex-col overflow-hidden rounded-[22px] bg-card shadow-card-lg",
          className,
        )}
      >
        <div className="flex justify-center pt-3 md:hidden">
          <span className="h-1 w-10 rounded-full bg-line-2" />
        </div>
        {children}
      </div>
    </div>
  );
}
