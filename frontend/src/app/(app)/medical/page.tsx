"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  calculateSugarBarrier,
  deleteMedicalReport,
  listMedicalReports,
  patchMedicalReport,
  type MedicalReportPatch,
} from "@/lib/api";
import { Badge, Button, Card, Skeleton, useToast } from "@/components/ui";
import {
  FileTextIcon,
  PencilIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
} from "@/components/icons";
import { EditReportDialog } from "@/components/medical/EditReportDialog";
import { getToday, localDayKey } from "@/lib/date";
import { formatDateLong } from "@/lib/format";
import {
  applyIntakeTargets,
  getStoredProfile,
  hasPersonalBasics,
} from "@/lib/profile";
import { MEDICAL_DISCLAIMER, reportPanel, reportPanelMeta } from "@/lib/medical";
import type { MedicalReportSummary, NutritionTargets } from "@/lib/types";
import { cn } from "@/lib/cn";

function reportDateKey(report: MedicalReportSummary): string {
  if (report.test_date) return report.test_date.slice(0, 10);
  return localDayKey(report.created_at);
}

function fileHref(path: string): string {
  if (path.startsWith("/uploads/")) return path;
  const name = path.split(/[/\\]/).pop();
  return name ? `/uploads/${name}` : path;
}

type MetricBit = {
  label: string;
  value: string;
  status?: string | null;
  section: "blood_sugar" | "lipid";
};

function metricBits(report: MedicalReportSummary): MetricBit[] {
  const bits: MetricBit[] = [];
  if (report.hba1c != null) {
    bits.push({
      label: "HbA1c",
      value: `${report.hba1c}%`,
      status: report.hba1c_status,
      section: "blood_sugar",
    });
  }
  if (report.fasting_glucose != null) {
    bits.push({
      label: "Fasting glucose",
      value: `${report.fasting_glucose}`,
      status: report.fasting_glucose_status,
      section: "blood_sugar",
    });
  }
  if (report.total_cholesterol != null) {
    bits.push({
      label: "Total chol.",
      value: `${report.total_cholesterol}`,
      status: report.total_cholesterol_status,
      section: "lipid",
    });
  }
  if (report.ldl != null) {
    bits.push({
      label: "LDL",
      value: `${report.ldl}`,
      status: report.ldl_status,
      section: "lipid",
    });
  }
  if (report.hdl != null) {
    bits.push({
      label: "HDL",
      value: `${report.hdl}`,
      status: report.hdl_status,
      section: "lipid",
    });
  }
  if (report.triglycerides != null) {
    bits.push({
      label: "Triglycerides",
      value: `${report.triglycerides}`,
      status: report.triglycerides_status,
      section: "lipid",
    });
  }
  return bits;
}

function statusTone(status?: string | null): "teal" | "amber" | "red" | "neutral" {
  if (status === "high" || status === "low") return "red";
  if (status === "normal") return "teal";
  return "neutral";
}

function MetricGrid({ bits }: { bits: MetricBit[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {bits.map((m) => (
        <div key={m.label} className="rounded-[12px] bg-app-bg px-3 py-2.5">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-semibold text-ink-3">{m.label}</span>
            {m.status && m.status !== "unknown" && (
              <Badge tone={statusTone(m.status)}>{m.status}</Badge>
            )}
          </div>
          <div className="mt-1 text-[16px] font-extrabold text-ink">{m.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function MedicalHistoryPage() {
  const { toast } = useToast();
  const [reports, setReports] = useState<MedicalReportSummary[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [targets, setTargets] = useState<NutritionTargets>(
    getStoredProfile().targets,
  );
  const [barrierNote, setBarrierNote] = useState(
    getStoredProfile().sugarBarrierNote,
  );
  const [goalSource, setGoalSource] = useState(getStoredProfile().goalSource);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const todayIso = getToday();

  const refresh = useCallback(() => {
    const stored = getStoredProfile();
    setTargets(stored.targets);
    setBarrierNote(stored.sugarBarrierNote);
    setGoalSource(stored.goalSource);
    listMedicalReports().then((next) => {
      setReports(next);
      setSelectedId((prev) => {
        if (prev && next.some((r) => r.id === prev)) return prev;
        return next[0]?.id ?? null;
      });
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = useMemo(
    () => reports?.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId],
  );

  const selectedPanel = useMemo(
    () => (selected ? reportPanelMeta(reportPanel(selected)) : null),
    [selected],
  );

  const selectedSugar = useMemo(
    () => (selected ? metricBits(selected).filter((b) => b.section === "blood_sugar") : []),
    [selected],
  );

  const selectedLipid = useMemo(
    () => (selected ? metricBits(selected).filter((b) => b.section === "lipid") : []),
    [selected],
  );

  async function onRecommendIntake() {
    setBusy(true);
    setMsg(null);
    try {
      const profile = getStoredProfile();
      if (!hasPersonalBasics(profile.personal)) {
        setMsg("Add age, sex, and height in Profile first.");
        return;
      }
      const latest = reports?.[0];
      const result = await calculateSugarBarrier({
        age: profile.personal.age,
        sex: profile.personal.sex,
        height_cm: profile.personal.height_cm,
        hba1c: latest?.hba1c ?? null,
        fasting_glucose: latest?.fasting_glucose ?? null,
      });
      const stored = applyIntakeTargets(
        {
          calories: result.calories ?? targets.calories,
          sugar_g: result.sugar_limit_g,
          water_cups: result.water_cups ?? targets.water_cups,
        },
        result.rationale,
      );
      setTargets(stored.targets);
      setGoalSource(stored.goalSource);
      setBarrierNote(stored.sugarBarrierNote);
      setMsg(
        `Recommended ${result.calories ?? stored.targets.calories} kcal, ${result.sugar_limit_g} g sugar, and ${result.water_cups ?? stored.targets.water_cups} cups water (250 ml each) / day.`,
      );
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not calculate intake.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSave(id: number, patch: MedicalReportPatch) {
    setActionBusy(true);
    try {
      await patchMedicalReport(id, patch);
      toast({ title: "Report updated", variant: "success" });
      setEditing(false);
      refresh();
    } catch (err) {
      toast({
        title: "Couldn’t update report",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
    } finally {
      setActionBusy(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    setActionBusy(true);
    try {
      await deleteMedicalReport(selected.id);
      toast({ title: "Report removed", variant: "success" });
      setConfirmDelete(false);
      setSelectedId(null);
      refresh();
    } catch (err) {
      toast({
        title: "Couldn’t remove report",
        description: err instanceof Error ? err.message : "Try again",
        variant: "error",
      });
      setConfirmDelete(false);
    } finally {
      setActionBusy(false);
    }
  }

  if (!reports) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-[24px] font-extrabold tracking-tight text-ink">
          Medical records
        </h1>
        <Skeleton className="h-28" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[920px]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[24px]">
            Medical records
          </h1>
          <p className="mt-1 text-[13px] font-medium text-ink-3">
            Lab upload history and AI intake recommendations
          </p>
        </div>
        <Link
          href="/scan/medical"
          className="inline-flex items-center gap-1.5 rounded-[11px] bg-teal px-3.5 py-2 text-[12.5px] font-bold text-navy-ink transition hover:bg-teal-d"
        >
          <PlusIcon size={14} />
          Upload report
        </Link>
      </div>

      <Card className="mb-4 p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <SparkleIcon size={16} className="text-teal-d" />
              <span className="text-[14px] font-bold text-ink">
                Recommended daily intake
              </span>
              {goalSource === "nutrion" && (
                <Badge tone="teal">From medical + profile</Badge>
              )}
            </div>
            <div className="mt-3 grid max-w-md grid-cols-3 gap-2">
              <div className="rounded-[12px] bg-app-bg px-3 py-2.5">
                <div className="text-[10px] font-semibold text-ink-3">Calories</div>
                <div className="mt-0.5 text-[18px] font-extrabold text-ink">
                  {targets.calories}
                  <span className="text-[11px] font-semibold text-ink-3"> kcal</span>
                </div>
              </div>
              <div className="rounded-[12px] bg-app-bg px-3 py-2.5">
                <div className="text-[10px] font-semibold text-ink-3">Sugar</div>
                <div className="mt-0.5 text-[18px] font-extrabold text-ink">
                  {targets.sugar_g}
                  <span className="text-[11px] font-semibold text-ink-3"> g</span>
                </div>
              </div>
              <div className="rounded-[12px] bg-app-bg px-3 py-2.5">
                <div className="text-[10px] font-semibold text-ink-3">Water</div>
                <div className="mt-0.5 text-[18px] font-extrabold text-ink">
                  {targets.water_cups}
                  <span className="text-[11px] font-semibold text-ink-3"> cups</span>
                </div>
                <div className="mt-0.5 text-[10px] font-medium text-ink-3">
                  250 ml each
                </div>
              </div>
            </div>
            {barrierNote && (
              <p className="mt-2 text-[12px] font-medium leading-snug text-ink-3">
                {barrierNote}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onRecommendIntake}
          >
            {busy ? "Calculating…" : "Auto-calculate intake"}
          </Button>
        </div>
        {msg && (
          <p className="mt-3 text-[12px] font-medium text-ink-2">{msg}</p>
        )}
      </Card>

      {reports.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-amber-t text-amber-d">
            <FileTextIcon size={22} />
          </span>
          <div className="text-[15px] font-bold text-ink">No medical reports yet</div>
          <p className="max-w-sm text-[13px] font-medium text-ink-3">
            Upload a lab report to track HbA1c, fasting glucose, and lipids — then
            let AI recommend your calorie and sugar targets.
          </p>
          <Link
            href="/scan/medical"
            className="mt-1 inline-flex items-center gap-1.5 rounded-[11px] bg-teal px-3.5 py-2 text-[12.5px] font-bold text-navy-ink"
          >
            <PlusIcon size={14} />
            Upload first report
          </Link>
        </Card>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-line px-4 py-3 text-[11px] font-bold tracking-wide text-ink-3">
              UPLOADS · {reports.length}
            </div>
            <ul>
              {reports.map((report, i) => {
                const key = reportDateKey(report);
                const active = report.id === selectedId;
                const panel = reportPanelMeta(reportPanel(report));
                return (
                  <li key={report.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(report.id);
                        setConfirmDelete(false);
                        setEditing(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3.5 text-left transition",
                        active ? "bg-teal-t/50" : "hover:bg-app-bg",
                        i < reports.length - 1 ? "border-b border-line" : "",
                      )}
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-amber-t text-amber-d">
                        <FileTextIcon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold text-ink">
                          Lab report #{report.id}
                        </div>
                        <div className="truncate text-[11.5px] font-medium text-ink-3">
                          {key === todayIso ? "Today" : formatDateLong(key)}
                          {report.hba1c != null ? ` · HbA1c ${report.hba1c}%` : ""}
                        </div>
                      </div>
                      <Badge tone={panel.tone}>{panel.short}</Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-4 md:p-5">
            {selected ? (
              <>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h2 className="text-[16px] font-extrabold text-ink">
                    Lab report #{selected.id}
                  </h2>
                  {selected.file_path ? (
                    <a
                      href={fileHref(selected.file_path)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] font-bold text-teal-d"
                    >
                      View file
                    </a>
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {selectedPanel && (
                    <Badge tone={selectedPanel.tone}>{selectedPanel.label}</Badge>
                  )}
                  <span className="text-[12px] font-medium text-ink-3">
                    {formatDateLong(reportDateKey(selected))}
                    {selected.confidence
                      ? ` · confidence ${Math.round(selected.confidence * 100)}%`
                      : ""}
                  </span>
                </div>

                {selectedSugar.length === 0 && selectedLipid.length === 0 ? (
                  <p className="mt-4 text-[13px] font-medium text-ink-3">
                    No supported metrics on this report.
                  </p>
                ) : (
                  <div className="mt-4 space-y-4">
                    {selectedSugar.length > 0 && (
                      <section>
                        <div className="mb-2 text-[10.5px] font-bold tracking-wide text-ink-3">
                          BLOOD SUGAR
                        </div>
                        <MetricGrid bits={selectedSugar} />
                      </section>
                    )}
                    {selectedLipid.length > 0 && (
                      <section>
                        <div className="mb-2 text-[10.5px] font-bold tracking-wide text-ink-3">
                          CHOLESTEROL / LIPIDS
                        </div>
                        <MetricGrid bits={selectedLipid} />
                      </section>
                    )}
                  </div>
                )}

                {selected.notes ? (
                  <p className="mt-4 text-[12px] font-medium text-ink-3">
                    {selected.notes}
                  </p>
                ) : null}

                {confirmDelete ? (
                  <div className="mt-5 rounded-[14px] border border-red/25 bg-red-t/60 px-3.5 py-3">
                    <p className="text-[13px] font-semibold text-red-d">
                      Remove this lab report?
                    </p>
                    <p className="mt-0.5 text-[12px] font-medium text-ink-3">
                      This can’t be undone from here.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={actionBusy}
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={actionBusy}
                        onClick={() => void handleDelete()}
                        className="flex-1 !bg-red !text-white hover:!bg-red-d"
                      >
                        {actionBusy ? "Removing…" : "Remove"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionBusy}
                      onClick={() => setEditing(true)}
                      className="flex-1"
                    >
                      <PencilIcon size={14} />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actionBusy}
                      onClick={() => setConfirmDelete(true)}
                      className="flex-1"
                    >
                      <TrashIcon size={14} />
                      Remove
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <p className="py-10 text-center text-[13px] font-medium text-ink-3">
                Select a report to view details.
              </p>
            )}
          </Card>
        </div>
      )}

      <p className="mt-4 text-[11px] font-medium leading-snug text-ink-3">
        {MEDICAL_DISCLAIMER}
      </p>

      {editing && selected ? (
        <EditReportDialog
          report={selected}
          onClose={() => setEditing(false)}
          onSave={handleSave}
        />
      ) : null}
    </div>
  );
}
