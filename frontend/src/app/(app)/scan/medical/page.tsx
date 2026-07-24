"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Skeleton } from "@/components/ui";
import { getAllEntries } from "@/lib/api";
import { getStoredSession } from "@/lib/auth";
import { saveMedicalMetrics } from "@/lib/store";
import { computeInsights } from "@/lib/analytics";
import { linkedInsight } from "@/lib/medical";
import { mockUser } from "@/lib/mock-data";
import { getToday } from "@/lib/date";
import type { IntakeEntry, MedicalMetric, Subscription } from "@/lib/types";
import { MedicalUploadStep } from "@/components/scan/medical/MedicalUploadStep";
import { MedicalProcessingStep } from "@/components/scan/medical/MedicalProcessingStep";
import { MedicalReviewStep } from "@/components/scan/medical/MedicalReviewStep";

type Step = "upload" | "processing" | "review";

export default function ScanMedicalPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [entries, setEntries] = useState<IntakeEntry[]>([]);
  const [step, setStep] = useState<Step>("upload");
  const [metrics, setMetrics] = useState<MedicalMetric[]>([]);

  useEffect(() => {
    setSubscription(getStoredSession()?.subscription ?? "free");
    getAllEntries().then(setEntries);
  }, []);

  const afternoonDays = useMemo(
    () => computeInsights(entries, mockUser.targets, getToday(), 7).afternoonPattern.count,
    [entries],
  );

  const confirmedMetrics = metrics.filter((m) => m.confirmed);
  const insight = linkedInsight(confirmedMetrics, afternoonDays);

  function persist(next: MedicalMetric[]) {
    setMetrics(next);
    // Only confirmed metrics are stored (product rule).
    saveMedicalMetrics(next.filter((m) => m.confirmed));
  }

  function editValue(id: string, value: number) {
    persist(metrics.map((m) => (m.id === id ? { ...m, value } : m)));
  }

  function confirm(id: string) {
    persist(metrics.map((m) => (m.id === id ? { ...m, confirmed: true } : m)));
  }

  function confirmAll() {
    persist(metrics.map((m) => ({ ...m, confirmed: true })));
  }

  if (subscription === null) {
    return <Skeleton className="h-40" />;
  }

  if (subscription !== "premium") {
    return (
      <Card className="p-6 text-center">
        <h1 className="text-[18px] font-extrabold text-ink">
          Medical report upload is Premium
        </h1>
        <p className="mx-auto mt-2 max-w-[320px] text-[13px] font-medium text-ink-2">
          Add lab results for educational, nutrition-linked context. You confirm
          every value — NutriON never diagnoses.
        </p>
        <Link
          href="/premium"
          className="mt-4 inline-block rounded-card-sm bg-teal px-5 py-3 text-[14px] font-bold text-white"
        >
          Go Premium
        </Link>
      </Card>
    );
  }

  return (
    <div className="py-1">
      {step === "upload" && (
        <MedicalUploadStep onUpload={() => setStep("processing")} />
      )}
      {step === "processing" && (
        <MedicalProcessingStep
          onDone={(m) => {
            setMetrics(m);
            setStep("review");
          }}
        />
      )}
      {step === "review" && (
        <MedicalReviewStep
          metrics={metrics}
          linkedInsight={insight}
          onEditValue={editValue}
          onConfirm={confirm}
          onConfirmAll={confirmAll}
        />
      )}
    </div>
  );
}
