"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  Badge,
  ProgressBar,
  LineChart,
  GroupedBarChart,
} from "@/components/ui";
import {
  AlertTriangleIcon,
  BulbIcon,
  ChartIcon,
  SparkleIcon,
} from "@/components/icons";
import {
  computeInsights,
  dailySeries,
  dailySodiumSaltWater,
} from "@/lib/analytics";
import { askBackend } from "@/lib/assistant";
import { getStoredSession } from "@/lib/auth";
import {
  fetchMedicalMetrics,
  type BackendMedicalMetric,
} from "@/lib/api";
import { linkedInsight, MEDICAL_DISCLAIMER, outOfRange } from "@/lib/medical";
import type { IntakeEntry, MedicalMetric, NutritionTargets } from "@/lib/types";

const PERIODS = [7, 30, 90] as const;

function mapMedical(m: BackendMedicalMetric): MedicalMetric {
  return {
    id: String(m.id),
    name: m.metric_name,
    value: m.value,
    unit: m.unit,
    refLow: m.reference_min ?? undefined,
    refHigh: m.reference_max ?? undefined,
    referenceText:
      m.reference_range_text ||
      (m.reference_min != null && m.reference_max != null
        ? `${m.reference_min}–${m.reference_max}`
        : ""),
    page: 1,
    confidence:
      m.extraction_confidence >= 0.75
        ? "high"
        : m.extraction_confidence >= 0.5
          ? "medium"
          : "low",
    confirmed: m.confirmed,
  };
}

function formatMetricDate(iso: string | null): string {
  if (!iso) return "Date unknown";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function InsightsPremium({
  entries,
  targets,
  endIso,
}: {
  entries: IntakeEntry[];
  targets: NutritionTargets;
  endIso: string;
}) {
  const [period, setPeriod] = useState<number>(7);
  const [metrics, setMetrics] = useState<BackendMedicalMetric[]>([]);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiNote, setAiNote] = useState<string | undefined>();

  const data = useMemo(
    () => computeInsights(entries, targets, endIso, period),
    [entries, targets, endIso, period],
  );

  const series = useMemo(
    () => dailySeries(entries, targets, endIso, period, "totalSugar_g"),
    [entries, targets, endIso, period],
  );

  const balance = useMemo(
    () => dailySodiumSaltWater(entries, targets, endIso, period),
    [entries, targets, endIso, period],
  );

  const topSource = data.sources[0] ?? null;
  const topMeal = data.calorieMeals[0] ?? null;
  const maxMeal = data.calorieMeals[0]?.value ?? 1;

  const cholesterol = useMemo(() => {
    const row = metrics.find((m) =>
      /cholesterol|ldl|hdl/i.test(m.metric_name),
    );
    return row ?? null;
  }, [metrics]);

  const mappedMetrics = useMemo(() => metrics.map(mapMedical), [metrics]);
  const bannerInsight = useMemo(
    () =>
      linkedInsight(
        mappedMetrics.filter((m) => m.confirmed),
        data.afternoonPattern.count,
      ),
    [mappedMetrics, data.afternoonPattern.count],
  );

  useEffect(() => {
    const userId = getStoredSession()?.userId ?? "default";
    fetchMedicalMetrics(userId).then(setMetrics);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const userId = getStoredSession()?.userId ?? "default";
    setAiLoading(true);
    setAiText(null);

    const question =
      `Summarize my strongest nutrition pattern over the last ${period} days ` +
      `from confirmed logs only. Focus on sugar timing, top sources, and one ` +
      `practical non-diagnostic suggestion. Keep it under 80 words.`;

    askBackend(question, userId).then((msg) => {
      if (cancelled) return;
      setAiText(msg.text);
      setAiNote(msg.note);
      setAiLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [period]);

  const dq = data.dataQuality;
  const completeness =
    dq.totalDays > 0
      ? Math.round((dq.completeDays / dq.totalDays) * 100)
      : 0;

  const avgTiles = [
    {
      key: "sodium",
      label: "Sodium",
      value: `${balance.averages.sodiumMg}`,
      unit: "mg/day",
      target: `${balance.dailyTargets.sodiumMg} mg`,
      pct: balance.averages.sodiumPct,
      tone: "bg-amber-t text-amber-d",
      bar: "bg-amber",
    },
    {
      key: "salt",
      label: "Salt",
      value: `${balance.averages.saltG}`,
      unit: "g/day",
      target: `${balance.dailyTargets.saltG} g`,
      pct: balance.averages.saltPct,
      tone: "bg-red-t text-red-d",
      bar: "bg-red",
    },
    {
      key: "water",
      label: "Water",
      value: `${balance.averages.waterCups}`,
      unit: "cups/day",
      target: `${balance.dailyTargets.waterCups} cups`,
      pct: balance.averages.waterPct,
      tone: "bg-blue-t text-blue-d",
      bar: "bg-blue",
    },
  ] as const;

  return (
    <div className="pb-6">
      <div className="mb-2 flex items-center gap-2.5">
        <h1 className="text-[24px] font-extrabold tracking-tight text-ink md:text-[26px]">
          Insights
        </h1>
        <Badge tone="amber">
          <SparkleIcon size={10} />
          PREMIUM
        </Badge>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="text-[14px] font-medium text-ink-2">
          Confirmed data ·
        </span>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-xl px-3.5 py-2 text-[13px] font-bold transition-colors ${
                period === p
                  ? "bg-navy text-white shadow-card"
                  : "border border-line-2 font-semibold text-ink-2 hover:bg-app-bg"
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Sugar trend */}
      <Card quiet className="mb-6 p-5 md:p-6">
        <SectionHead
          icon={<ChartIcon size={17} />}
          iconClass="bg-teal-t text-teal-d"
          title={`Sugar trend · last ${period} days`}
          subtitle={`Daily total vs your ${targets.sugar_g}g target`}
        />
        <LineChart
          data={series}
          height={240}
          target={targets.sugar_g}
          unit="g"
          colorClass="text-teal"
        />
      </Card>

      {/* Sodium / salt / water — per-day grouped bars */}
      <Card quiet className="mb-6 p-5 md:p-6">
        <SectionHead
          icon={<ChartIcon size={17} />}
          iconClass="bg-blue-t text-blue-d"
          title="Sodium · salt · water"
          subtitle={
            balance.weekly
              ? "Weekly averages as % of daily targets"
              : "Each day as % of daily targets"
          }
        />

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {avgTiles.map((t) => (
            <div
              key={t.key}
              className="rounded-2xl border border-line bg-app-bg px-4 py-4"
            >
              <div className={`mb-3 inline-flex rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${t.tone}`}>
                {t.label}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[28px] font-extrabold leading-none tracking-tight text-ink">
                  {t.value}
                </span>
                <span className="text-[13px] font-semibold text-ink-3">
                  {t.unit}
                </span>
              </div>
              <div className="mt-2 text-[12.5px] font-medium text-ink-2">
                Target {t.target} · {t.pct}% of daily goal
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                <div
                  className={`h-full rounded-full ${t.bar}`}
                  style={{ width: `${Math.min(100, t.pct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <GroupedBarChart
          height={260}
          series={[
            { key: "sodium", label: "Sodium", colorClass: "text-amber" },
            { key: "salt", label: "Salt", colorClass: "text-red" },
            { key: "water", label: "Water", colorClass: "text-blue" },
          ]}
          groups={balance.points.map((p) => ({
            label: p.label,
            shortLabel: balance.weekly ? p.shortLabel : p.shortLabel,
            values: {
              sodium: p.sodiumPct,
              salt: p.saltPct,
              water: p.waterPct,
            },
          }))}
        />

        <p className="mt-4 text-[13px] font-medium leading-relaxed text-ink-2">
          Bars show how each {balance.weekly ? "week" : "day"} compares to daily
          targets: <strong className="text-ink">2,300 mg</strong> sodium,{" "}
          <strong className="text-ink">5 g</strong> salt (estimated from sodium
          ×2.5), and your{" "}
          <strong className="text-ink">
            {balance.dailyTargets.waterCups}-cup
          </strong>{" "}
          water goal. Higher than the dashed line means over target that day.
        </p>
      </Card>

      {/* Macro accumulation */}
      <Card quiet className="mb-6 p-5 md:p-6">
        <SectionHead
          title={`Uploaded accumulation · ${period}d`}
          subtitle="Totals from confirmed food and drink logs"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {data.macros.map((m) => (
            <div
              key={m.key}
              className={`rounded-2xl px-4 py-4 ${m.colorClass}`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                {m.label}
              </div>
              <div className="mt-1 text-[22px] font-extrabold leading-tight">
                {m.value}
                <span className="ml-1 text-[12px] font-bold">{m.unit}</span>
              </div>
            </div>
          ))}
          <div className="rounded-2xl bg-navy/[0.06] px-4 py-4 text-ink">
            <div className="text-[11px] font-bold uppercase tracking-wide text-ink-3">
              Cholesterol
            </div>
            {cholesterol ? (
              <div className="mt-1 text-[22px] font-extrabold leading-tight">
                {cholesterol.value}
                <span className="ml-1 text-[12px] font-bold text-ink-2">
                  {cholesterol.unit}
                </span>
              </div>
            ) : (
              <div className="mt-2 text-[13px] font-semibold leading-snug text-ink-3">
                Upload a lipid report
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Ranked sources */}
      <div className="mb-6 grid gap-5 md:grid-cols-2">
        <Card quiet className="p-5 md:p-6">
          <SectionHead title="Top sugar drinks" />
          {data.sources.length === 0 ? (
            <p className="text-[14px] font-semibold text-ink-2">
              No sweetened drinks in this period.
            </p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {data.sources.map((s) => (
                <div key={s.name}>
                  <div className="mb-1.5 flex justify-between gap-3 text-[14px] font-semibold">
                    <span className="text-ink">{s.name}</span>
                    <span className="shrink-0 text-ink-2">{s.grams} g</span>
                  </div>
                  <ProgressBar
                    value={s.grams}
                    max={data.sources[0]?.grams || 1}
                    height={9}
                    colorClass="bg-amber"
                  />
                </div>
              ))}
              {topSource && (
                <p className="mt-1 text-[13px] font-medium leading-relaxed text-ink-2">
                  Most drink sugar came from {topSource.name.toLowerCase()}.
                </p>
              )}
            </div>
          )}
        </Card>

        <Card quiet className="p-5 md:p-6">
          <SectionHead title="Meals · most calories" />
          {data.calorieMeals.length === 0 ? (
            <p className="text-[14px] font-semibold text-ink-2">
              No food photos logged in this period.
            </p>
          ) : (
            <div className="flex flex-col gap-3.5">
              {data.calorieMeals.map((m) => (
                <div key={m.name}>
                  <div className="mb-1.5 flex justify-between gap-3 text-[14px] font-semibold">
                    <span className="text-ink">{m.name}</span>
                    <span className="shrink-0 text-ink-2">
                      {m.value.toLocaleString()} kcal
                    </span>
                  </div>
                  <ProgressBar
                    value={m.value}
                    max={maxMeal}
                    height={9}
                    colorClass="bg-teal-d"
                  />
                </div>
              ))}
              {topMeal && (
                <p className="mt-1 text-[13px] font-medium leading-relaxed text-ink-2">
                  Highest calorie meal: {topMeal.name.toLowerCase()}.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Habit strip */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {data.habits.map((h) => (
          <Card quiet key={h.label} className="p-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-3">
              {h.label}
            </div>
            <div className="text-[17px] font-extrabold leading-snug text-ink">
              {h.value}
            </div>
            <div className="mt-1.5 text-[13px] font-medium leading-relaxed text-ink-2">
              {h.note}
            </div>
          </Card>
        ))}
      </div>

      {/* AI pattern insight */}
      <div className="mb-6 overflow-hidden rounded-card-lg bg-gradient-to-br from-navy via-navy-2 to-[#1a4a5c] p-5 text-white shadow-card md:p-6">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold tracking-[0.08em] text-white/70">
          <SparkleIcon size={13} className="text-teal" />
          AI PATTERN INSIGHT · LAST {period} DAYS
        </div>

        {aiLoading ? (
          <div className="space-y-2.5 py-1">
            <div className="h-4 w-[92%] animate-pulse rounded bg-white/15" />
            <div className="h-4 w-[70%] animate-pulse rounded bg-white/10" />
            <div className="h-3 w-[50%] animate-pulse rounded bg-white/10" />
          </div>
        ) : (
          <>
            <p className="text-[16px] font-bold leading-relaxed md:text-[17px]">
              {aiText}
            </p>
            {aiNote && (
              <p className="mt-3 text-[13px] font-medium leading-relaxed text-white/65">
                {aiNote}
              </p>
            )}
          </>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-[12px] font-bold text-white/85">
            Data: {dq.confirmed + dq.estimated} logs
          </span>
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-[12px] font-bold text-white/85">
            Completeness {completeness}%
          </span>
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-[12px] font-bold text-white/85">
            {dq.confirmed} confirmed · {dq.estimated} estimated
          </span>
        </div>

        <Link
          href="/history"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[13.5px] font-bold text-navy transition-opacity hover:opacity-90"
        >
          <BulbIcon size={15} />
          Ask AI about this
        </Link>
      </div>

      {(metrics.length > 0 || bannerInsight) && (
        <div className="mb-6 space-y-4">
          {metrics.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {metrics.slice(0, 4).map((m) => {
                const mapped = mapMedical(m);
                const high = outOfRange(mapped);
                return (
                  <Card quiet key={m.id} className="p-5 md:p-6">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="text-[15px] font-bold text-ink">
                        {m.metric_name}
                      </span>
                      <Badge tone={m.confirmed ? "teal" : "blue"}>
                        {m.confirmed
                          ? "Confirmed by you"
                          : "Awaiting confirmation"}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[32px] font-extrabold leading-none text-ink">
                        {m.value}
                        {m.unit.includes("%") ? "%" : ""}
                      </span>
                      <span className="text-[13px] font-medium text-ink-3">
                        {m.reference_range_text
                          ? `ref ${m.reference_range_text}`
                          : m.unit && !m.unit.includes("%")
                            ? m.unit
                            : ""}
                      </span>
                    </div>
                    <p className="mt-3 text-[13px] font-medium text-ink-2">
                      {formatMetricDate(m.test_date)} · Lab report (uploaded)
                      {high ? " · outside printed reference" : ""}
                    </p>
                    <p className="mt-2 text-[13.5px] font-medium leading-relaxed text-ink-2">
                      {m.confirmed
                        ? high
                          ? `${m.metric_name} is outside its printed reference range. Discuss with a qualified professional — NutriON does not diagnose.`
                          : `${m.metric_name} is within the printed reference range on this report.`
                        : "Extracted by AI — confirm the value before relying on it in insights."}
                    </p>
                    <Link
                      href="/scan?mode=medical"
                      className="mt-4 inline-flex rounded-xl border border-line-2 px-3.5 py-2 text-[13px] font-bold text-ink-2 transition-colors hover:border-navy hover:text-ink"
                    >
                      Discuss with a professional
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}

          {bannerInsight && (
            <div className="flex items-start gap-3 rounded-card bg-amber-t px-5 py-4">
              <AlertTriangleIcon
                size={18}
                className="mt-0.5 shrink-0 text-amber-d"
              />
              <p className="text-[14px] font-medium leading-relaxed text-amber-d">
                {bannerInsight}
              </p>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="mb-3 text-[12px] font-bold tracking-wide text-ink-3">
          DATA QUALITY
        </div>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <QualityChip tone="teal" label={`${dq.confirmed} confirmed entries`} />
          <QualityChip
            tone="amber"
            label={`${dq.estimated} AI-estimated entries`}
          />
          <QualityChip
            tone="amber"
            label={`${dq.lowConfidence} low-confidence`}
          />
          <QualityChip
            tone="blue"
            label={`${Math.max(0, dq.incompleteDays)} incomplete days`}
          />
          <QualityChip
            tone="blue"
            label={`${metrics.filter((m) => !m.confirmed).length} medical awaiting`}
          />
        </div>
        <p className="mt-4 text-[13px] font-medium leading-relaxed text-ink-3">
          NutriON&rsquo;s insights are only as good as the data behind them —
          confirm estimated entries to improve reliability. {MEDICAL_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}

function SectionHead({
  title,
  subtitle,
  icon,
  iconClass,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  iconClass?: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {icon && (
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClass ?? "bg-app-bg text-ink-2"}`}
        >
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <div className="text-[15px] font-extrabold tracking-tight text-ink">
          {title}
        </div>
        {subtitle && (
          <div className="mt-0.5 text-[13px] font-medium text-ink-3">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

function QualityChip({
  tone,
  label,
}: {
  tone: "teal" | "amber" | "blue";
  label: string;
}) {
  const bg =
    tone === "teal"
      ? "bg-teal-t text-teal-d"
      : tone === "amber"
        ? "bg-amber-t text-amber-d"
        : "bg-blue-t text-blue-d";
  return (
    <div className={`rounded-xl px-4 py-3 text-[13px] font-bold ${bg}`}>
      {label}
    </div>
  );
}
