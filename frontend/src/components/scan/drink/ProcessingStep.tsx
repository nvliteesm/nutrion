"use client";

import { useEffect, useState } from "react";
import { extractDrinkLabel } from "@/lib/extract";
import type { ExtractedDrink } from "@/lib/types";
import { CheckIcon } from "@/components/icons";

const steps = [
  "Image uploaded",
  "Reading nutrition label",
  "Extracting values",
  "Validating units",
];

export function ProcessingStep({
  onDone,
}: {
  onDone: (drink: ExtractedDrink) => void;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    // Visually advance the checklist while the (mock) extraction runs.
    const interval = setInterval(() => {
      setActive((n) => Math.min(n + 1, steps.length - 1));
    }, 550);

    extractDrinkLabel().then((drink) => {
      clearInterval(interval);
      onDone(drink);
    });

    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div className="mx-auto flex min-h-[520px] w-full max-w-[420px] flex-col">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-[15px] font-semibold text-ink-3">‹</span>
        <span className="text-[15px] font-bold text-ink">Reading label</span>
      </div>

      <div className="relative mb-6 h-44 overflow-hidden rounded-card bg-[#16110c]">
        <div className="absolute inset-0 flex items-center justify-center text-[11.5px] font-medium text-white/50">
          Captured label
        </div>
        <div className="absolute inset-x-0 top-1/2 h-[3px] animate-pulse bg-teal shadow-[0_0_12px_2px_var(--color-teal)]" />
      </div>

      <div className="flex flex-col">
        {steps.map((label, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <div
              key={label}
              className={`flex items-center gap-3 py-3 ${
                i > active ? "opacity-40" : ""
              }`}
            >
              {done ? (
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal text-white">
                  <CheckIcon size={13} />
                </span>
              ) : current ? (
                <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-[2.5px] border-teal border-t-transparent" />
              ) : (
                <span className="h-6 w-6 shrink-0 rounded-full border-2 border-line-2" />
              )}
              <span className="text-[13.5px] font-semibold text-ink">
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-auto pt-6 text-center text-[12px] font-medium text-ink-3">
        This usually takes a few seconds
      </p>
    </div>
  );
}
