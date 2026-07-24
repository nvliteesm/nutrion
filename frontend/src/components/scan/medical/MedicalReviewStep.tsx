"use client";

import { Card, Button, Badge, ConfidenceBadge } from "@/components/ui";
import { AlertTriangleIcon, BulbIcon, CheckIcon, FileTextIcon } from "@/components/icons";
import { MEDICAL_DISCLAIMER, outOfRange } from "@/lib/medical";
import type { MedicalMetric } from "@/lib/types";

export function MedicalReviewStep({
  metrics,
  linkedInsight,
  onEditValue,
  onConfirm,
  onConfirmAll,
}: {
  metrics: MedicalMetric[];
  linkedInsight: string | null;
  onEditValue: (id: string, value: number) => void;
  onConfirm: (id: string) => void;
  onConfirmAll: () => void;
}) {
  const outNames = metrics
    .filter((m) => outOfRange(m))
    .map((m) => m.name);
  const remaining = metrics.filter((m) => !m.confirmed).length;

  return (
    <div>
      <div className="mb-1 flex items-center gap-2.5">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[24px]">
          Medical report
        </h1>
        <Badge tone="amber">PREMIUM</Badge>
      </div>
      <p className="mb-4 text-[13px] font-medium leading-relaxed text-ink-2">
        Confirm each extracted value. Only values you confirm are stored and used
        — for educational context, never diagnosis.
      </p>

      <Card className="mb-4 flex items-center gap-3 p-4">
        <span className="inline-flex h-11 w-9 items-center justify-center rounded-[8px] bg-red-t text-red-d">
          <FileTextIcon size={18} />
        </span>
        <div>
          <div className="text-[13px] font-bold text-ink">labs_report.pdf</div>
          <div className="text-[11px] font-medium text-ink-3">
            Report date Jul 22 · 3 pages
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-2.5">
        {metrics.map((metric) => {
          const isOut = outOfRange(metric);
          return (
            <Card
              key={metric.id}
              className={`p-4 ${isOut ? "ring-1 ring-amber" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13.5px] font-bold text-ink">
                    {metric.name}
                  </div>
                  <div className="mt-0.5 text-[10.5px] font-medium text-ink-3">
                    p.{metric.page} · Ref {metric.referenceText}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={metric.value}
                    onChange={(e) =>
                      onEditValue(metric.id, Number(e.target.value) || 0)
                    }
                    className="w-20 rounded-md border border-line-2 bg-white px-2 py-1 text-right text-[15px] font-bold text-ink focus:border-teal focus:outline-none"
                  />
                  <span className="text-[11px] font-semibold text-ink-3">
                    {metric.unit}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <ConfidenceBadge confidence={metric.confidence} short />
                {metric.confirmed ? (
                  <Badge tone="teal">
                    <CheckIcon size={11} />
                    Confirmed
                  </Badge>
                ) : (
                  <Button size="sm" onClick={() => onConfirm(metric.id)}>
                    Confirm
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {remaining > 0 && (
        <Button
          variant="navy"
          size="lg"
          fullWidth
          className="mt-4"
          onClick={onConfirmAll}
        >
          Confirm all remaining ({remaining})
        </Button>
      )}

      {outNames.length > 0 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-card bg-amber-t px-4 py-3.5">
          <AlertTriangleIcon size={18} className="mt-px shrink-0 text-amber-d" />
          <p className="text-[12px] font-medium leading-relaxed text-amber-d">
            {outNames.join(" and ")}{" "}
            {outNames.length === 1 ? "appears" : "appear"} outside the reference
            range printed on your report. {MEDICAL_DISCLAIMER}
          </p>
        </div>
      )}

      {linkedInsight && (
        <div className="mt-4 rounded-card-lg bg-gradient-to-br from-navy to-navy-2 p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-white/[0.14] text-teal">
              <BulbIcon size={15} />
            </span>
            <span className="text-[11px] font-bold tracking-wide text-white/70">
              NUTRITION-LINKED CONTEXT
            </span>
          </div>
          <p className="mb-2 text-[14px] font-semibold leading-relaxed text-white">
            {linkedInsight}
          </p>
          <p className="text-[11.5px] font-medium leading-relaxed text-white/60">
            This is an observed pattern, not a cause-and-effect finding. NutriON
            does not diagnose or change any medical goals.
          </p>
        </div>
      )}
    </div>
  );
}
