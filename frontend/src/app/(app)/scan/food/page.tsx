"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addEntry } from "@/lib/store";
import type { FoodAnalysis, IntakeEntry } from "@/lib/types";
import { FoodCaptureStep } from "@/components/scan/food/FoodCaptureStep";
import { FoodProcessingStep } from "@/components/scan/food/FoodProcessingStep";
import { FoodReviewStep } from "@/components/scan/food/FoodReviewStep";

type Step = "capture" | "processing" | "review";

export default function ScanFoodPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("capture");
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);

  function handleConfirm(entry: Omit<IntakeEntry, "id">) {
    addEntry(entry);
    router.push("/today");
  }

  return (
    <div className="py-1">
      {step === "capture" && (
        <FoodCaptureStep onCapture={() => setStep("processing")} />
      )}
      {step === "processing" && (
        <FoodProcessingStep
          onDone={(a) => {
            setAnalysis(a);
            setStep("review");
          }}
        />
      )}
      {step === "review" && analysis && (
        <FoodReviewStep analysis={analysis} onConfirm={handleConfirm} />
      )}
    </div>
  );
}
