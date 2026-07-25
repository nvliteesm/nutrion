"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, ConfidenceBadge } from "@/components/ui";
import {
  analyzeDrink,
  analyzeFood,
  analyzeMedical,
  confirmDrink,
  confirmFood,
  confirmMedical,
} from "@/lib/api";
import { getCurrentUserId } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { applyIntakeTargets, getStoredProfile } from "@/lib/profile";
import { SCAN_RESUME_KEY } from "@/components/scan/ScanCaptureSheet";
import { CameraCapture } from "@/components/scan/CameraCapture";
import { CameraIcon } from "@/components/icons";
import type {
  Confidence,
  DrinkLabelData,
  FoodAnalysisData,
  FoodItemEstimate,
  MedicalMetricData,
  ScanMode,
} from "@/lib/types";
import { MEDICAL_METRIC_GROUPS } from "@/lib/types";

type Step = "pick" | "upload" | "review" | "done";

/** Survives React Strict Mode remounts so resume=1 does not fall back to upload. */
type ScanResumePayload = {
  mode: ScanMode;
  analysis_id: string;
  drink?: DrinkLabelData;
  food?: FoodAnalysisData;
  metrics?: MedicalMetricData[];
};
let scanResumeCache: ScanResumePayload | null = null;

function scoreToConfidence(score: number): Confidence {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  return "low";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-2">{label}</span>
      {children}
    </label>
  );
}

function inputClassName() {
  return cn(
    "w-full rounded-card-sm border border-line bg-card px-3 py-2.5 text-sm text-ink",
    "outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20",
  );
}

function NumberInput({
  value,
  onChange,
  step = "any",
  min,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  step?: string;
  min?: number;
}) {
  return (
    <input
      type="number"
      className={inputClassName()}
      value={value ?? ""}
      step={step}
      min={min}
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
    />
  );
}

function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      className={inputClassName()}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const modes: {
  id: ScanMode;
  title: string;
  blurb: string;
  accept: string;
  accent: string;
}[] = [
  {
    id: "drink",
    title: "Scan drink",
    blurb:
      "Reads a nutrition label when present; otherwise AI estimates the beverage (rejects food).",
    accept: "image/*",
    accent: "border-blue/30 bg-blue-t",
  },
  {
    id: "food",
    title: "Food",
    blurb: "Vision estimate of items and portions — always editable.",
    accept: "image/*",
    accent: "border-line bg-card",
  },
  {
    id: "medical",
    title: "Medical report",
    blurb:
      "Blood Sugar (HbA1c, Fasting Glucose) + Lipid Profile (TC, LDL, HDL, TG).",
    accept: "image/*,.pdf,.txt,.md",
    accent: "border-amber/30 bg-amber-t",
  },
];

export default function ScanPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("pick");
  const [mode, setMode] = useState<ScanMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const [drink, setDrink] = useState<DrinkLabelData | null>(null);
  const [food, setFood] = useState<FoodAnalysisData | null>(null);
  const [metrics, setMetrics] = useState<MedicalMetricData[]>([]);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [fromGallery, setFromGallery] = useState(false);

  const activeMode = useMemo(
    () => modes.find((m) => m.id === mode) ?? null,
    [mode],
  );

  // Deep-link: /scan?mode=… jumps to upload, or resume=1 loads a pre-analyzed result.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const m = params.get("mode");
    const source = params.get("source");
    const resume = params.get("resume");
    if (source === "gallery") setFromGallery(true);

    if (resume === "1") {
      try {
        if (!scanResumeCache) {
          const raw = sessionStorage.getItem(SCAN_RESUME_KEY);
          if (raw) {
            scanResumeCache = JSON.parse(raw) as ScanResumePayload;
            sessionStorage.removeItem(SCAN_RESUME_KEY);
          }
        }
        const data = scanResumeCache;
        if (data?.mode === "drink" && data.drink) {
          setMode("drink");
          setAnalysisId(data.analysis_id);
          setDrink(data.drink);
          setStep("review");
          return;
        }
        if (data?.mode === "food" && data.food) {
          setMode("food");
          setAnalysisId(data.analysis_id);
          setFood(data.food);
          setStep("review");
          return;
        }
        if (data?.mode === "medical" && data.metrics) {
          setMode("medical");
          setAnalysisId(data.analysis_id);
          setMetrics(data.metrics);
          setStep("review");
          return;
        }
      } catch {
        scanResumeCache = null;
        /* fall through to normal deep-link */
      }
    }

    if (m === "drink" || m === "food" || m === "medical") {
      setMode(m);
      setStep("upload");
    }
  }, []);

  // Auto-open gallery file picker when arriving via source=gallery.
  useEffect(() => {
    if (step === "upload" && fromGallery && !busy && fileRef.current) {
      const t = window.setTimeout(() => fileRef.current?.click(), 250);
      return () => window.clearTimeout(t);
    }
  }, [step, fromGallery, busy]);

  function resetAll() {
    // Cancel/back leaves the scan picker — return to where the user came from.
    if (mode === "medical") {
      router.push("/medical");
      return;
    }
    if (mode === "food" || mode === "drink") {
      router.push("/today");
      return;
    }
    scanResumeCache = null;
    setStep("pick");
    setMode(null);
    setBusy(false);
    setFromGallery(false);
    setError(null);
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setAnalysisId(null);
    setSavedId(null);
    setDrink(null);
    setFood(null);
    setMetrics([]);
    setAiSuggestion(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  /** After save: medical → records; food/drink → Today. */
  function exitAfterSave() {
    if (mode === "medical") {
      router.push("/medical");
      return;
    }
    // Force a fresh data fetch when landing on Today (bypasses Next.js cache).
    router.push("/today?t=" + Date.now());
    router.refresh();
  }

  /** Clear result and log another of the same type (stay on upload). */
  function logAnother() {
    scanResumeCache = null;
    setBusy(false);
    setError(null);
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setAnalysisId(null);
    setSavedId(null);
    setDrink(null);
    setFood(null);
    setMetrics([]);
    setAiSuggestion(null);
    if (fileRef.current) fileRef.current.value = "";
    if (mode) {
      setStep("upload");
    } else {
      setStep("pick");
    }
  }

  function pickMode(next: ScanMode) {
    setMode(next);
    setStep("upload");
    setError(null);
  }

  async function runAnalyze(file: File) {
    if (!mode) return;

    setBusy(true);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }

    try {
      if (mode === "drink") {
        const res = await analyzeDrink(file);
        setAnalysisId(res.analysis_id);
        setDrink(res.drink);
      } else if (mode === "food") {
        const res = await analyzeFood(file);
        setAnalysisId(res.analysis_id);
        setFood(res.food);
      } else {
        const res = await analyzeMedical(file);
        setAnalysisId(res.analysis_id);
        setMetrics(res.metrics);
      }
      setStep("review");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analyze failed";
      const withRetry = /try again/i.test(msg)
        ? msg
        : `${msg}${msg.endsWith(".") ? "" : "."} Please try again.`;
      setError(`${activeMode?.title ?? "Scan"}: ${withRetry}`);
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setBusy(false);
    }
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void runAnalyze(file);
  }

  function handleCameraCapture(file: File) {
    setCameraOpen(false);
    void runAnalyze(file);
  }

  async function onConfirm() {
    if (!analysisId || !mode) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "drink" && drink) {
        const res = await confirmDrink(analysisId, drink);
        setSavedId(`intake #${res.intake_id}`);
      } else if (mode === "food" && food) {
        const res = await confirmFood(analysisId, food);
        const ids = res.intake_ids?.length ? res.intake_ids : [res.intake_id];
        setSavedId(
          ids.length === 1
            ? `intake #${ids[0]}`
            : `${ids.length} intakes (#${ids.join(", #")})`,
        );
      } else if (mode === "medical") {
        const profile = getStoredProfile();
        const res = await confirmMedical(analysisId, metrics, undefined, {
          age: profile.personal.age,
          sex: profile.personal.sex,
          height_cm: profile.personal.height_cm,
        });
        if (res.sugar_barrier?.sugar_limit_g) {
          applyIntakeTargets(
            {
              calories: res.sugar_barrier.calories,
              sugar_g: res.sugar_barrier.sugar_limit_g,
              water_cups: res.sugar_barrier.water_cups,
            },
            res.sugar_barrier.rationale,
          );
          const cal = res.sugar_barrier.calories;
          const water = res.sugar_barrier.water_cups;
          setSavedId(
            `report #${res.report_id ?? res.metric_ids[0]} · ${cal ? `${cal} kcal · ` : ""}${res.sugar_barrier.sugar_limit_g} g sugar${water ? ` · ${water} cups water` : ""}/day`,
          );
        } else {
          setSavedId(`report #${res.report_id ?? res.metric_ids[0]}`);
        }
      }
      setStep("done");
      // Proactive AI: suggest a healthier alternative (non-blocking).
      const itemName = mode === "drink" ? drink?.product_name : food?.items?.[0]?.name;
      if (itemName && mode !== "medical") {
        fetch("/api/ai/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: `I just logged "${itemName}". What's a lower-sugar alternative I could try next time? Keep it to 1-2 sentences.`,
            user_id: getCurrentUserId(),
          }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => { if (d?.answer) setAiSuggestion(d.answer); })
          .catch(() => {});
      }
      // Auto-send Telegram notification after every confirm (non-blocking).
      fetch("/api/telegram/send-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: "1176087052", user_id: getCurrentUserId() }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function updateFoodItem(index: number, patch: Partial<FoodItemEstimate>) {
    setFood((prev) => {
      if (!prev) return prev;
      const items = prev.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      );
      return {
        ...prev,
        items,
        total_calories: items.reduce((s, i) => s + i.calories, 0),
        total_protein_g: items.reduce((s, i) => s + i.protein_g, 0),
        total_carbs_g: items.reduce((s, i) => s + i.carbs_g, 0),
        total_fat_g: items.reduce((s, i) => s + i.fat_g, 0),
        total_fiber_g: items.reduce((s, i) => s + i.fiber_g, 0),
        total_sugar_g: items.reduce((s, i) => s + i.sugar_g, 0),
        total_sodium_mg: items.reduce((s, i) => s + i.sodium_mg, 0),
      };
    });
  }

  function updateMetricByName(
    name: string,
    patch: Partial<MedicalMetricData>,
  ) {
    setMetrics((prev) =>
      prev.map((m) => (m.metric_name === name ? { ...m, ...patch } : m)),
    );
  }

  const medicalGroups = useMemo(() => {
    return MEDICAL_METRIC_GROUPS.map((group) => ({
      ...group,
      items: group.metrics
        .map((name) => metrics.find((m) => m.metric_name === name))
        .filter((m): m is MedicalMetricData => Boolean(m)),
    })).filter((g) => g.items.length > 0);
  }, [metrics]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
          Log something
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
          Scan & confirm
        </h1>
        <p className="mt-1.5 text-sm text-ink-2">
          Upload → review the extracted result → save only what you confirm.
        </p>
      </header>

      {error && (
        <div className="flex items-center justify-between rounded-card-sm border border-red/20 bg-red-t px-4 py-3 text-sm text-red-d">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-3 shrink-0 text-red-d/60 hover:text-red-d"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {step === "pick" && (
        <div className="grid gap-3">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => pickMode(m.id)}
              className={cn(
                "rounded-card-lg border px-5 py-4 text-left transition hover:shadow-card",
                m.accent,
              )}
            >
              <div className="text-base font-extrabold text-ink">{m.title}</div>
              <p className="mt-1 text-sm text-ink-2">{m.blurb}</p>
            </button>
          ))}
        </div>
      )}

      {step === "upload" && activeMode && (
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="text-lg font-extrabold text-ink">{activeMode.title}</h2>
            <p className="mt-1 text-sm text-ink-2">{activeMode.blurb}</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={activeMode.accept}
            className="hidden"
            onChange={onFileChange}
          />
          {fromGallery || mode === "medical" ? (
            <>
              <Button
                fullWidth
                size="lg"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {busy
                  ? "Analyzing…"
                  : mode === "medical"
                    ? "Upload report"
                    : "Choose from gallery"}
              </Button>
              {mode !== "medical" && (
                <Button
                  variant="outline"
                  fullWidth
                  size="lg"
                  disabled={busy}
                  onClick={() => setCameraOpen(true)}
                >
                  <CameraIcon size={18} />
                  Take photo instead
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                fullWidth
                size="lg"
                disabled={busy}
                onClick={() => setCameraOpen(true)}
              >
                <CameraIcon size={18} />
                {busy ? "Analyzing…" : "Take photo"}
              </Button>
              <Button
                variant="outline"
                fullWidth
                size="lg"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                Choose from gallery
              </Button>
            </>
          )}
          <Button variant="ghost" fullWidth disabled={busy} onClick={resetAll}>
            Back
          </Button>
        </Card>
      )}

      {step === "review" && (
        <div className="space-y-4">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Upload preview"
              className="max-h-52 w-full rounded-card-lg object-cover shadow-card"
            />
          )}

          {mode === "drink" && drink && (
            <Card className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-ink">
                  {drink.analysis_mode === "photo"
                    ? "Drink photo estimate"
                    : "Drink label result"}
                </h2>
                <ConfidenceBadge confidence={scoreToConfidence(drink.confidence)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Product name">
                  <TextInput
                    value={drink.product_name}
                    onChange={(v) => setDrink({ ...drink, product_name: v })}
                  />
                </Field>
                <Field label="Serving size">
                  <TextInput
                    value={drink.serving_size}
                    onChange={(v) => setDrink({ ...drink, serving_size: v })}
                  />
                </Field>
                <Field label="Servings per container">
                  <NumberInput
                    value={drink.servings_per_container}
                    onChange={(v) =>
                      setDrink({ ...drink, servings_per_container: v })
                    }
                  />
                </Field>
                <Field label="Drink volume (ml)">
                  <NumberInput
                    value={drink.drink_volume_ml}
                    onChange={(v) => setDrink({ ...drink, drink_volume_ml: v })}
                  />
                </Field>
                <Field label="Calories">
                  <NumberInput
                    value={drink.calories}
                    onChange={(v) => setDrink({ ...drink, calories: v ?? 0 })}
                  />
                </Field>
                <Field label="Carbohydrates (g)">
                  <NumberInput
                    value={drink.carbohydrates_g}
                    onChange={(v) =>
                      setDrink({ ...drink, carbohydrates_g: v ?? 0 })
                    }
                  />
                </Field>
                <Field label="Total sugar (g)">
                  <NumberInput
                    value={drink.total_sugar_g}
                    onChange={(v) =>
                      setDrink({ ...drink, total_sugar_g: v ?? 0 })
                    }
                  />
                </Field>
                <Field label="Added sugar (g)">
                  <NumberInput
                    value={drink.added_sugar_g}
                    onChange={(v) =>
                      setDrink({ ...drink, added_sugar_g: v ?? 0 })
                    }
                  />
                </Field>
                <Field label="Sodium (mg)">
                  <NumberInput
                    value={drink.sodium_mg}
                    onChange={(v) => setDrink({ ...drink, sodium_mg: v })}
                  />
                </Field>
                <Field label="Caffeine (mg)">
                  <NumberInput
                    value={drink.caffeine_mg}
                    onChange={(v) => setDrink({ ...drink, caffeine_mg: v })}
                  />
                </Field>
              </div>
            </Card>
          )}

          {mode === "food" && food && (
            <div className="space-y-3">
              <Card className="flex items-center justify-between gap-3 p-5">
                <div>
                  <h2 className="text-lg font-extrabold text-ink">
                    Food estimate
                  </h2>
                  <p className="mt-1 text-sm text-ink-2">
                    {food.description || `${food.items.length} detected item(s)`}
                  </p>
                </div>
                <ConfidenceBadge confidence={scoreToConfidence(food.confidence)} />
              </Card>
              {food.items.map((item, index) => (
                <Card key={`${item.name}-${index}`} className="space-y-3 p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Item name">
                      <TextInput
                        value={item.name}
                        onChange={(v) => updateFoodItem(index, { name: v })}
                      />
                    </Field>
                    <Field label="Portion">
                      <TextInput
                        value={item.portion}
                        onChange={(v) => updateFoodItem(index, { portion: v })}
                      />
                    </Field>
                    <Field label="Calories">
                      <NumberInput
                        value={item.calories}
                        onChange={(v) =>
                          updateFoodItem(index, { calories: v ?? 0 })
                        }
                      />
                    </Field>
                    <Field label="Protein (g)">
                      <NumberInput
                        value={item.protein_g}
                        onChange={(v) =>
                          updateFoodItem(index, { protein_g: v ?? 0 })
                        }
                      />
                    </Field>
                    <Field label="Carbs (g)">
                      <NumberInput
                        value={item.carbs_g}
                        onChange={(v) =>
                          updateFoodItem(index, { carbs_g: v ?? 0 })
                        }
                      />
                    </Field>
                    <Field label="Fat (g)">
                      <NumberInput
                        value={item.fat_g}
                        onChange={(v) =>
                          updateFoodItem(index, { fat_g: v ?? 0 })
                        }
                      />
                    </Field>
                    <Field label="Sugar (g)">
                      <NumberInput
                        value={item.sugar_g}
                        onChange={(v) =>
                          updateFoodItem(index, { sugar_g: v ?? 0 })
                        }
                      />
                    </Field>
                    <Field label="Sodium (mg)">
                      <NumberInput
                        value={item.sodium_mg}
                        onChange={(v) =>
                          updateFoodItem(index, { sodium_mg: v ?? 0 })
                        }
                      />
                    </Field>
                  </div>
                </Card>
              ))}
              <Card className="p-4 text-sm text-ink-2">
                Totals:{" "}
                <span className="font-bold text-ink">
                  {Math.round(food.total_calories)} kcal
                </span>
                {" · "}
                {Math.round(food.total_carbs_g)}g carbs ·{" "}
                {Math.round(food.total_sugar_g)}g sugar
              </Card>
            </div>
          )}

          {mode === "medical" && (
            <div className="space-y-4">
              <Card className="p-5">
                <h2 className="text-lg font-extrabold text-ink">
                  Extracted metrics
                </h2>
                <p className="mt-1 text-sm text-ink-2">
                  Only Blood Sugar and Lipid Profile fields are extracted.
                  Edit before saving.
                </p>
                <ul className="mt-3 grid gap-1 text-xs text-ink-3 sm:grid-cols-2">
                  <li>
                    <span className="font-bold text-ink-2">Blood Sugar:</span>{" "}
                    HbA1c · Fasting Blood Glucose
                  </li>
                  <li>
                    <span className="font-bold text-ink-2">Lipid Profile:</span>{" "}
                    Total Cholesterol · LDL · HDL · Triglycerides
                  </li>
                </ul>
              </Card>
              {metrics.length === 0 && (
                <Card className="p-5 text-sm text-ink-2">
                  No supported metrics were found. Try a clearer report or PDF.
                </Card>
              )}
              {medicalGroups.map((group) => (
                <div key={group.category} className="space-y-3">
                  <h3 className="px-1 text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
                    {group.title}
                  </h3>
                  {group.items.map((m) => (
                    <Card
                      key={m.metric_name}
                      className="space-y-3 p-5"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-extrabold text-ink">
                          {m.metric_name}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase",
                            m.status === "high" && "bg-red-t text-red-d",
                            m.status === "low" && "bg-amber-t text-amber-d",
                            m.status === "normal" && "bg-teal-t text-teal-d",
                            m.status === "unknown" && "bg-app-bg text-ink-3",
                          )}
                        >
                          {m.status}
                        </span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Value">
                          <NumberInput
                            value={m.value}
                            onChange={(v) =>
                              updateMetricByName(m.metric_name, {
                                value: v ?? 0,
                              })
                            }
                          />
                        </Field>
                        <Field label="Unit">
                          <TextInput
                            value={m.unit}
                            onChange={(v) =>
                              updateMetricByName(m.metric_name, { unit: v })
                            }
                          />
                        </Field>
                        <Field label="Test date">
                          <input
                            type="date"
                            className={inputClassName()}
                            value={m.test_date ?? ""}
                            onChange={(e) =>
                              updateMetricByName(m.metric_name, {
                                test_date: e.target.value || null,
                              })
                            }
                          />
                        </Field>
                        <Field label="Ref min">
                          <NumberInput
                            value={m.reference_min}
                            onChange={(v) =>
                              updateMetricByName(m.metric_name, {
                                reference_min: v,
                              })
                            }
                          />
                        </Field>
                        <Field label="Ref max">
                          <NumberInput
                            value={m.reference_max}
                            onChange={(v) =>
                              updateMetricByName(m.metric_name, {
                                reference_max: v,
                              })
                            }
                          />
                        </Field>
                        <Field label="Reference text">
                          <TextInput
                            value={m.reference_range_text}
                            onChange={(v) =>
                              updateMetricByName(m.metric_name, {
                                reference_range_text: v,
                              })
                            }
                          />
                        </Field>
                      </div>
                      <p className="text-xs text-ink-3">
                        Confidence{" "}
                        {(m.extraction_confidence * 100).toFixed(0)}%
                        {m.source_page != null
                          ? ` · page ${m.source_page}`
                          : ""}
                      </p>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              fullWidth
              size="lg"
              disabled={
                busy ||
                (mode === "medical" && metrics.length === 0) ||
                (mode === "food" && (!food || food.items.length === 0))
              }
              onClick={onConfirm}
            >
              {busy ? "Saving…" : "Confirm & save"}
            </Button>
            <Button variant="outline" fullWidth disabled={busy} onClick={resetAll}>
              Start over
            </Button>
          </div>
        </div>
      )}

      {cameraOpen && activeMode && (
        <CameraCapture
          title={activeMode.title}
          onCapture={handleCameraCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {step === "done" && (
        <Card className="space-y-4 p-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal">
            Saved
          </p>
          <h2 className="text-xl font-extrabold text-ink">
            Entry confirmed
          </h2>
          <p className="text-sm text-ink-2">
            Stored {savedId}. Only confirmed values feed your daily totals.
          </p>

          {aiSuggestion && (
            <div className="rounded-card bg-teal-t px-4 py-3 text-left">
              <div className="mb-1 text-[10.5px] font-bold tracking-wide text-teal-d">
                AI SUGGESTION
              </div>
              <p className="text-[13px] font-medium leading-relaxed text-ink">
                {aiSuggestion}
              </p>
            </div>
          )}
          {!aiSuggestion && mode !== "medical" && (
            <div className="flex items-center justify-center gap-2 py-2 text-[12px] font-medium text-ink-3">
              <span className="h-2 w-2 animate-pulse rounded-full bg-teal" />
              Getting a suggestion…
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button fullWidth onClick={exitAfterSave}>
              {mode === "medical" ? "Go to Medical records" : "Go to Today"}
            </Button>
            <Button variant="outline" fullWidth onClick={logAnother}>
              {mode === "medical" ? "Upload another" : "Log another"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
