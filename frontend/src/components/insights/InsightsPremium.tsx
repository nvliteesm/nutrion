"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, Badge, ProgressBar } from "@/components/ui";
import {
  AlertTriangleIcon,
  BulbIcon,
  ChartIcon,
  SearchIcon,
  SparkleIcon,
} from "@/components/icons";
import { LineChart } from "@/components/ui";
import { computeInsights, dailySeries } from "@/lib/analytics";
import type { IntakeEntry, NutritionTargets } from "@/lib/types";

const PERIODS = [7, 30, 90] as const;

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
  const data = useMemo(
    () => computeInsights(entries, targets, endIso, period),
    [entries, targets, endIso, period],
  );

  const topSource = data.sources[0] ?? null;
  const series = useMemo(
    () => dailySeries(entries, targets, endIso, period, "totalSugar_g"),
    [entries, targets, endIso, period],
  );

  return (
    <div>
      <div className="mb-1 flex items-center gap-2.5">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[24px]">
          Insights
        </h1>
        <Badge tone="amber">
          <SparkleIcon size={10} />
          PREMIUM
        </Badge>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-ink-2">
          Based on confirmed data ·
        </span>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-[9px] px-3 py-1.5 text-[12px] font-bold transition-colors ${
                period === p
                  ? "bg-navy text-white"
                  : "border border-line-2 font-semibold text-ink-2"
              }`}
            >
              {p} days
            </button>
          ))}
        </div>
      </div>

      <Card className="mb-4 p-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-teal-t text-teal-d">
            <ChartIcon size={16} />
          </span>
          <span className="text-[11px] font-bold tracking-wide text-ink-3">
            TOTAL SUGAR TREND
          </span>
        </div>
        <LineChart
          data={series}
          target={targets.sugar_g}
          unit="g"
          colorClass="text-teal"
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <InsightCard icon={<SearchIcon size={16} />} iconClass="bg-teal-t text-teal-d" label="PATTERN DETECTED">
          <p className="text-[15px] font-semibold leading-relaxed text-ink">
            {data.afternoonPattern.count > 0 ? (
              <>
                You had a sweetened drink after 3 PM on{" "}
                {data.afternoonPattern.count} of the last{" "}
                {data.afternoonPattern.days} days.
              </>
            ) : (
              <>No repeated afternoon sweetened-drink pattern in the last 7 days.</>
            )}
          </p>
        </InsightCard>

        <InsightCard icon={<ChartIcon size={16} />} iconClass="bg-blue-t text-blue-d" label="CORRELATION">
          {data.correlation ? (
            <>
              <p className="mb-2.5 text-[15px] font-semibold leading-relaxed text-ink">
                On {data.correlation.highSugarDays} higher sugar day
                {data.correlation.highSugarDays === 1 ? "" : "s"},{" "}
                {data.correlation.alsoAboveCalories} also went above your calorie
                target.
              </p>
              <p className="text-[11.5px] font-medium leading-relaxed text-ink-3">
                This is an observed relationship and does not prove that one
                caused the other.
              </p>
            </>
          ) : (
            <p className="text-[15px] font-semibold leading-relaxed text-ink">
              No above-target sugar days in this period to correlate.
            </p>
          )}
        </InsightCard>

        <InsightCard icon={<ChartIcon size={16} />} iconClass="bg-teal-t text-teal-d" label="TOP SUGAR SOURCE">
          {topSource ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-[30px] font-extrabold leading-none text-ink">
                  {topSource.percent}%
                </span>
                <span className="text-[13px] font-semibold text-ink-2">
                  from {topSource.name.toLowerCase()}
                </span>
              </div>
              <ProgressBar
                value={topSource.percent}
                max={100}
                height={8}
                className="mt-3"
              />
              <div className="mt-2 text-[11.5px] font-medium text-ink-3">
                Of your recorded drink sugar this period
              </div>
            </>
          ) : (
            <p className="text-[15px] font-semibold text-ink">
              No sweetened drinks recorded in this period.
            </p>
          )}
        </InsightCard>

        <InsightCard icon={<ChartIcon size={16} />} iconClass="bg-teal-t text-teal-d" label="WEEK OVER WEEK">
          {data.weekOverWeekPercent !== null ? (
            <p className="text-[15px] font-semibold leading-relaxed text-ink">
              Average sugar intake{" "}
              {data.weekOverWeekPercent <= 0 ? (
                <span className="text-teal-d">
                  decreased {Math.abs(data.weekOverWeekPercent)}%
                </span>
              ) : (
                <span className="text-amber-d">
                  increased {data.weekOverWeekPercent}%
                </span>
              )}{" "}
              compared with the previous week.
            </p>
          ) : (
            <p className="text-[15px] font-semibold text-ink">
              Not enough data to compare weeks yet.
            </p>
          )}
        </InsightCard>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-card bg-amber-t px-4 py-3.5">
        <AlertTriangleIcon size={18} className="mt-px shrink-0 text-amber-d" />
        <p className="text-[12.5px] font-medium leading-relaxed text-amber-d">
          <span className="font-bold">Data quality:</span>{" "}
          {data.dataQuality.completeDays} of the last {data.dataQuality.totalDays}{" "}
          days have complete meal logs, so averages may be underestimated.
        </p>
      </div>

      <Link href="/assistant" className="mt-4 block">
        <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-card-lg">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-navy text-teal">
            <BulbIcon size={18} />
          </span>
          <div className="flex-1">
            <div className="text-[14px] font-bold text-ink">
              Ask the nutrition assistant
            </div>
            <div className="text-[12px] font-medium text-ink-2">
              Questions about your confirmed history — no diagnosis, just context.
            </div>
          </div>
          <span className="text-ink-3">›</span>
        </Card>
      </Link>
    </div>
  );
}

function InsightCard({
  icon,
  iconClass,
  label,
  children,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className={`inline-flex h-[30px] w-[30px] items-center justify-center rounded-[9px] ${iconClass}`}>
          {icon}
        </span>
        <span className="text-[11px] font-bold tracking-wide text-ink-3">
          {label}
        </span>
      </div>
      {children}
    </Card>
  );
}
