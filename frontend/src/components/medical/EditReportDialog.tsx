"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Field } from "@/components/auth/Field";
import { XIcon } from "@/components/icons";
import { parseNonNegative } from "@/lib/nutrition";
import type { MedicalReportPatch } from "@/lib/api";
import type { MedicalReportSummary } from "@/lib/types";

type MetricKey =
  | "hba1c"
  | "fasting_glucose"
  | "total_cholesterol"
  | "ldl"
  | "hdl"
  | "triglycerides";

const METRIC_FIELDS: { key: MetricKey; label: string }[] = [
  { key: "hba1c", label: "HbA1c (%)" },
  { key: "fasting_glucose", label: "Fasting glucose" },
  { key: "total_cholesterol", label: "Total cholesterol" },
  { key: "ldl", label: "LDL" },
  { key: "hdl", label: "HDL" },
  { key: "triglycerides", label: "Triglycerides" },
];

function optionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return parseNonNegative(trimmed);
}

/** Compact editor for a saved lab report's core metrics. */
export function EditReportDialog({
  report,
  onClose,
  onSave,
}: {
  report: MedicalReportSummary;
  onClose: () => void;
  onSave: (id: number, patch: MedicalReportPatch) => void | Promise<void>;
}) {
  const [testDate, setTestDate] = useState(
    report.test_date?.slice(0, 10) ?? "",
  );
  const [notes, setNotes] = useState(report.notes ?? "");
  const [values, setValues] = useState<Record<MetricKey, string>>({
    hba1c: report.hba1c != null ? String(report.hba1c) : "",
    fasting_glucose:
      report.fasting_glucose != null ? String(report.fasting_glucose) : "",
    total_cholesterol:
      report.total_cholesterol != null ? String(report.total_cholesterol) : "",
    ldl: report.ldl != null ? String(report.ldl) : "",
    hdl: report.hdl != null ? String(report.hdl) : "",
    triglycerides:
      report.triglycerides != null ? String(report.triglycerides) : "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const patch: MedicalReportPatch = {
        test_date: testDate.trim() || null,
        notes: notes.trim(),
        hba1c: optionalNumber(values.hba1c),
        fasting_glucose: optionalNumber(values.fasting_glucose),
        total_cholesterol: optionalNumber(values.total_cholesterol),
        ldl: optionalNumber(values.ldl),
        hdl: optionalNumber(values.hdl),
        triglycerides: optionalNumber(values.triglycerides),
      };
      await onSave(report.id, patch);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-ink/40 p-0 md:items-center md:p-4"
      onClick={saving ? undefined : onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit lab report #${report.id}`}
        className="max-h-[90vh] w-full max-w-[440px] animate-slide-up overflow-y-auto rounded-t-card-lg bg-card p-5 md:animate-scale-in md:rounded-card-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold text-ink">
            Edit lab report
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="text-ink-3 disabled:opacity-50"
          >
            <XIcon size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field
              label="Test date"
              name="test_date"
              type="date"
              value={testDate}
              onChange={(e) => setTestDate(e.target.value)}
            />
          </div>
          {METRIC_FIELDS.map(({ key, label }) => (
            <Field
              key={key}
              label={label}
              name={key}
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              value={values[key]}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [key]: e.target.value }))
              }
              placeholder="—"
            />
          ))}
          <div className="col-span-2">
            <Field
              label="Notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={saving}
            onClick={() => void handleSave()}
            className="flex-1"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
