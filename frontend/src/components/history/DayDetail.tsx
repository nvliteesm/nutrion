import { Card, Badge, SourceBadge, type BadgeTone } from "@/components/ui";
import { CupIcon, UtensilsIcon } from "@/components/icons";
import { formatDateLong, formatNumber, formatTime } from "@/lib/format";
import {
  calendarLabel,
  calendarStatus,
  type CalendarStatus,
} from "@/lib/history";
import { buildDailyTotals } from "@/lib/nutrition";
import type { IntakeEntry, NutritionTargets } from "@/lib/types";
import { cn } from "@/lib/cn";

const statusTone: Record<CalendarStatus, BadgeTone> = {
  within: "teal",
  moderate: "amber",
  significant: "red",
  incomplete: "blue",
  none: "neutral",
};

export function DayDetail({
  dateIso,
  entries,
  targets,
  onSelectEntry,
}: {
  dateIso: string;
  entries: IntakeEntry[];
  targets: NutritionTargets;
  onSelectEntry?: (entry: IntakeEntry) => void;
}) {
  const totals = buildDailyTotals(dateIso, entries, targets);
  const status = calendarStatus(totals, targets);
  const nonWater = entries
    .filter((e) => e.type !== "water")
    .sort((a, b) => (a.loggedAt < b.loggedAt ? -1 : 1));

  return (
    <Card className="w-full self-start p-5">
      <div className="mb-1 flex min-h-[28px] items-center justify-between gap-2">
        <span className="text-[16px] font-extrabold text-ink">
          {formatDateLong(dateIso)}
        </span>
        {status !== "none" && (
          <Badge tone={statusTone[status]}>{calendarLabel[status]}</Badge>
        )}
      </div>

      {totals.entryCount === 0 ? (
        <p className="py-8 text-center text-[13px] font-medium text-ink-3">
          No entries logged on this day.
        </p>
      ) : (
        <>
          <div className="my-3.5 grid grid-cols-2 gap-2.5">
            <Metric
              label="Calories"
              value={`${formatNumber(totals.calories)}`}
              sub={`/ ${formatNumber(targets.calories)}`}
            />
            <Metric
              label="Added sugar"
              value={`${totals.addedSugar_g}`}
              sub={`/ ${targets.sugar_g} g`}
              accent="amber"
            />
            <Metric label="Carbs" value={`${totals.carbs_g}`} sub="g" />
            <Metric
              label="Hydration"
              value={`${totals.water_cups}`}
              sub={`/ ${targets.water_cups} cups`}
              accent="blue"
            />
          </div>

          <div className="mb-1.5 text-[11px] font-bold tracking-wide text-ink-3">
            ENTRIES · {nonWater.length}
          </div>

          <ul>
            {nonWater.map((entry, i) => {
              const Icon = entry.type === "drink" ? CupIcon : UtensilsIcon;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEntry?.(entry)}
                    className={cn(
                      "flex w-full items-center gap-2.5 py-2.5 text-left transition hover:bg-app-bg/80",
                      i < nonWater.length - 1 ? "border-b border-line" : "",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
                        entry.type === "drink"
                          ? "bg-blue-t text-blue-d"
                          : "bg-teal-t text-teal-d",
                      )}
                    >
                      <Icon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[12.5px] font-semibold text-ink">
                          {entry.name}
                        </span>
                        <SourceBadge source={entry.source} />
                      </div>
                      <div className="text-[10.5px] font-medium text-ink-3">
                        {formatTime(entry.loggedAt)}
                      </div>
                    </div>
                    <span className="text-[11.5px] font-semibold text-ink-3">
                      {formatNumber(entry.nutrients.calories)} kcal
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: "amber" | "blue";
}) {
  const labelColor =
    accent === "amber"
      ? "text-amber-d"
      : accent === "blue"
        ? "text-blue-d"
        : "text-ink-3";
  return (
    <div className="rounded-[11px] bg-app-bg px-3 py-2.5">
      <div className={`text-[10.5px] font-semibold ${labelColor}`}>{label}</div>
      <div className="mt-0.5 text-[17px] font-extrabold text-ink">
        {value}
        <span className="text-[10px] font-semibold text-ink-3"> {sub}</span>
      </div>
    </div>
  );
}
