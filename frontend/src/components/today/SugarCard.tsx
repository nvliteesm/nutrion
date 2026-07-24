"use client";

import { Card, ProgressRing } from "@/components/ui";
import type { DailyStatus } from "@/lib/types";
import { cn } from "@/lib/cn";

export function SugarCard({
  sugar,
  target,
}: {
  sugar: number;
  target: number;
}) {
  const left = Math.max(target - sugar, 0);
  const pct = target > 0 ? Math.round((sugar / target) * 100) : 0;
  const status: DailyStatus =
    sugar > target ? "above" : sugar >= target * 0.85 ? "approaching" : "within";

  const ringColor =
    status === "above"
      ? "text-red"
      : status === "approaching"
        ? "text-amber"
        : "text-teal";

  const badge =
    status === "above"
      ? { label: "Over limit", cls: "bg-red-t text-red-d" }
      : status === "approaching"
        ? { label: "Getting close", cls: "bg-amber-t text-amber-d" }
        : { label: "Within target", cls: "bg-teal-t text-teal-d" };

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden p-4 md:p-5">
      <div className="flex min-h-0 flex-1 items-center gap-3">
        <ProgressRing
          value={sugar}
          max={target}
          size={76}
          strokeWidth={8}
          colorClass={ringColor}
          trackClass="text-line"
          className="shrink-0"
        >
          <span className="text-[12px] font-extrabold leading-none text-ink">
            {pct}%
          </span>
          <span className="mt-0.5 text-[8px] font-semibold leading-none text-ink-3">
            of limit
          </span>
        </ProgressRing>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold text-ink">
            Sugar intake
          </div>
          <div className="mt-1.5 truncate text-[18px] font-extrabold leading-none text-ink">
            {Math.round(sugar)}
            <span className="text-[12px] font-extrabold"> g</span>{" "}
            <span className="text-[11px] font-semibold text-ink-3">
              consumed
            </span>
          </div>
          <div className="mt-1 truncate text-[11px] font-semibold text-ink-2">
            {left} g left · limit {target} g
          </div>
          <span
            className={cn(
              "mt-2 inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-bold",
              badge.cls,
            )}
          >
            {badge.label}
          </span>
        </div>
      </div>
    </Card>
  );
}
