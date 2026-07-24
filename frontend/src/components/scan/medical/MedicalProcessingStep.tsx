"use client";

import { useEffect, useState } from "react";
import { extractMedicalReport } from "@/lib/extract";
import type { MedicalMetric } from "@/lib/types";
import { CheckIcon } from "@/components/icons";

const steps = [
  "Uploading report",
  "Extracting text",
  "Detecting medical metrics",
  "Validating values and units",
];

export function MedicalProcessingStep({
  onDone,
}: {
  onDone: (metrics: MedicalMetric[]) => void;
}) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActive((n) => Math.min(n + 1, steps.length - 1));
    }, 550);

    extractMedicalReport().then((metrics) => {
      clearInterval(interval);
      onDone(metrics);
    });

    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div className="mx-auto flex min-h-[420px] w-full max-w-[420px] flex-col">
      <div className="mb-6 flex items-center gap-3">
        <span className="text-[15px] font-semibold text-ink-3">‹</span>
        <span className="text-[15px] font-bold text-ink">Processing report</span>
      </div>

      <div className="flex flex-col">
        {steps.map((label, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <div
              key={label}
              className={`flex items-center gap-3 py-3 ${i > active ? "opacity-40" : ""}`}
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
              <span className="text-[13.5px] font-semibold text-ink">{label}</span>
            </div>
          );
        })}
      </div>

      <p className="mt-auto pt-6 text-center text-[12px] font-medium text-ink-3">
        You&rsquo;ll confirm every extracted value next
      </p>
    </div>
  );
}
