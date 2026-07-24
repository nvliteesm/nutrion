"use client";

import { useEffect, useState } from "react";
import { Card, ProgressBar, StatusPill } from "@/components/ui";
import type { DailyStatus } from "@/lib/types";

interface TopSource {
  name: string;
  percent: number;
}

async function fetchTopSource(): Promise<TopSource | null> {
  try {
    const res = await fetch("/api/analytics/top-sugar-sources?user_id=default&drinks_only=false&limit=1");
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.items?.[0];
    if (!item) return null;
    return { name: item.name, percent: Math.round(item.percent_of_period_sugar) };
  } catch {
    return null;
  }
}

export function SugarCard({
  sugar,
  target,
}: {
  sugar: number;
  target: number;
}) {
  const [topSource, setTopSource] = useState<TopSource | null>(null);

  useEffect(() => {
    fetchTopSource().then(setTopSource);
  }, []);

  const left = target - sugar;
  const status: DailyStatus =
    sugar > target ? "above" : sugar >= target * 0.85 ? "approaching" : "within";
  const summary =
    left >= 0 ? `Within target · ${left} g left` : `${Math.abs(left)} g over target`;

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-ink-2 md:text-[13px]">
          Total sugar
        </span>
        <div className="hidden md:block">
          <StatusPill status={status} label={statusShort(status)} />
        </div>
      </div>

      <div className="mb-2.5 mt-2 flex items-baseline gap-1.5">
        <span className="text-[22px] font-extrabold leading-none text-ink md:text-[28px]">
          {sugar}
        </span>
        <span className="text-[12px] font-semibold text-ink-3 md:text-[13px]">
          / {target} g
        </span>
      </div>

      <ProgressBar
        value={sugar}
        max={target}
        height={8}
        colorClass={colorFor(status)}
      />

      <div className={`mt-1.5 text-[10.5px] font-semibold ${textFor(status)}`}>
        {summary}
      </div>

      {topSource && (
        <div className="mt-2 text-[10.5px] font-medium text-ink-3">
          Top source: <span className="font-semibold text-ink-2">{topSource.name}</span>{" "}
          ({topSource.percent}% this week)
        </div>
      )}
    </Card>
  );
}

function statusShort(status: DailyStatus): string {
  if (status === "above") return "Above target";
  if (status === "approaching") return "Approaching";
  return "Within target";
}

function colorFor(status: DailyStatus): string {
  if (status === "above") return "bg-red";
  if (status === "approaching") return "bg-amber";
  return "bg-teal";
}

function textFor(status: DailyStatus): string {
  if (status === "above") return "text-red-d";
  if (status === "approaching") return "text-amber-d";
  return "text-teal-d";
}
