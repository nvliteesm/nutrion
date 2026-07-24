import { Card, ProgressBar, ProgressRing, StatusPill } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import type { DailyTotals, GoalSource, NutritionTargets } from "@/lib/types";

const goalLabel: Record<GoalSource, string> = {
  user: "goal set by you",
  nutrion: "suggested by NutriON",
};

export function CalorieHero({
  totals,
  targets,
  goalSource,
}: {
  totals: DailyTotals;
  targets: NutritionTargets;
  goalSource: GoalSource;
}) {
  const remaining = Math.max(targets.calories - totals.calories, 0);

  return (
    <Card className="p-5 md:p-6">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-bold text-ink-2">Calories today</span>
        <StatusPill status={totals.status} />
      </div>

      <div className="mt-3 flex items-center gap-5 md:gap-[26px]">
        <ProgressRing
          value={totals.calories}
          max={targets.calories}
          size={140}
          className="shrink-0 md:hidden"
        >
          <span className="text-[28px] font-extrabold leading-none text-ink">
            {formatNumber(remaining)}
          </span>
          <span className="mt-0.5 text-[10.5px] font-semibold text-ink-3">
            kcal left
          </span>
        </ProgressRing>

        <ProgressRing
          value={totals.calories}
          max={targets.calories}
          size={172}
          className="hidden shrink-0 md:block"
        >
          <span className="text-[34px] font-extrabold leading-none tracking-tight text-ink">
            {formatNumber(remaining)}
          </span>
          <span className="mt-0.5 text-[11.5px] font-semibold text-ink-3">
            kcal left
          </span>
        </ProgressRing>

        <div className="flex flex-1 flex-col gap-3.5">
          <div>
            <div className="mb-1.5 flex justify-between text-[12px] font-semibold text-ink-2">
              <span>Consumed</span>
              <span className="text-ink">
                {formatNumber(totals.calories)} / {formatNumber(targets.calories)} kcal
              </span>
            </div>
            <ProgressBar value={totals.calories} max={targets.calories} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Macro label="Protein" value={totals.protein_g} />
            <Macro label="Carbs" value={totals.carbs_g} />
            <Macro label="Fat" value={totals.fat_g} />
          </div>

          <div className="text-[12px] font-semibold text-ink-3">
            Target {formatNumber(targets.calories)} kcal · {goalLabel[goalSource]}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-ink-3">
        {label}
      </div>
      <div className="mt-0.5 text-[16px] font-bold text-ink">
        {formatNumber(value)}
        <span className="text-[11px] font-semibold text-ink-3"> g</span>
      </div>
    </div>
  );
}
