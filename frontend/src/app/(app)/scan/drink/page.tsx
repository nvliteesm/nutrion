"use client";

import { useState } from "react";
import { addEntry, getEntries } from "@/lib/store";
import { buildDailyTotals } from "@/lib/nutrition";
import { getToday } from "@/lib/date";
import { DEFAULT_TARGETS } from "@/lib/types";
import type { ExtractedDrink, IntakeEntry } from "@/lib/types";
import { CaptureStep } from "@/components/scan/drink/CaptureStep";
import { ProcessingStep } from "@/components/scan/drink/ProcessingStep";
import { ReviewStep } from "@/components/scan/drink/ReviewStep";
import {
  SavedStep,
  type SavedSummary,
} from "@/components/scan/drink/SavedStep";

type Step = "capture" | "processing" | "review" | "saved";

export default function ScanDrinkPage() {
  const [step, setStep] = useState<Step>("capture");
  const [drink, setDrink] = useState<ExtractedDrink | null>(null);
  const [summary, setSummary] = useState<SavedSummary | null>(null);

  function handleConfirm(entry: Omit<IntakeEntry, "id">) {
    addEntry(entry);
    const today = getToday();
    const todays = getEntries().filter(
      (e) => e.loggedAt.slice(0, 10) === today,
    );
    const totals = buildDailyTotals(today, todays, DEFAULT_TARGETS);
    setSummary({
      productName: entry.name,
      addedSugarTotal: totals.addedSugar_g,
      addedSugarTarget: DEFAULT_TARGETS.addedSugar_g,
    });
    setStep("saved");
  }

  function reset() {
    setDrink(null);
    setSummary(null);
    setStep("capture");
  }

  return (
    <div className="py-1">
      {step === "capture" && <CaptureStep onCapture={() => setStep("processing")} />}

      {step === "processing" && (
        <ProcessingStep
          onDone={(d) => {
            setDrink(d);
            setStep("review");
          }}
        />
      )}

      {step === "review" && drink && (
        <ReviewStep drink={drink} onConfirm={handleConfirm} />
      )}

      {step === "saved" && summary && (
        <SavedStep summary={summary} onLogAnother={reset} />
      )}
    </div>
  );
}
