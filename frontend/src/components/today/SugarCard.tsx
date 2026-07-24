"use client";

import { Card, ProgressRing } from "@/components/ui";
import { sugarBand, sugarBandStyles } from "@/lib/nutrition";
import { cn } from "@/lib/cn";

export function SugarCard({
  sugar,
  target,
  delay = 0,
}: {
  sugar: number;
  target: number;
  delay?: number;
}) {
  const left = Math.max(target - sugar, 0);
  const pct = target > 0 ? Math.round((sugar / target) * 100) : 0;
  const band = sugarBand(sugar, target);
  const styles = sugarBandStyles(band);

  return (
    <Card
      className="flex h-full min-h-0 flex-col overflow-hidden p-4 md:p-5"
      delay={delay}
    >
      <div className="grid min-h-0 flex-1 grid-cols-2 items-center gap-3 md:gap-5">
        <div className="flex h-full min-h-[148px] items-center justify-center">
          <div className="aspect-square h-full max-h-full w-auto max-w-full min-h-[148px]">
            <ProgressRing
              value={sugar}
              max={target}
              strokeWidth={9}
              colorClass={styles.ring}
              trackClass="text-line"
              className="h-full w-full"
            >
              <span
                className={cn(
                  "text-[20px] font-extrabold leading-none md:text-[22px]",
                  styles.value,
                )}
              >
                {pct}%
              </span>
              <span className="mt-1 text-[10px] font-semibold leading-none text-ink-3 md:text-[11px]">
                of limit
              </span>
            </ProgressRing>
          </div>
        </div>

        <div className="flex min-w-0 flex-col justify-center">
          <h2 className="text-[22px] font-extrabold leading-tight tracking-tight text-ink md:text-[24px]">
            Sugar intake
          </h2>
          <div
            className={cn(
              "mt-3 text-[28px] font-extrabold leading-none md:text-[32px]",
              styles.value,
            )}
          >
            {Math.round(sugar)}
            <span className="text-[16px] font-extrabold"> g</span>
          </div>
          <div className="mt-1.5 text-[13px] font-semibold text-ink-3">
            consumed
          </div>
          <div className="mt-3 text-[13px] font-semibold text-ink-2">
            {left} g left · limit {target} g
          </div>
          <span
            className={cn(
              "mt-3 inline-flex max-w-full truncate self-start rounded-full px-2.5 py-1 text-[11px] font-bold",
              styles.badge,
            )}
          >
            {styles.label}
          </span>
        </div>
      </div>
    </Card>
  );
}
