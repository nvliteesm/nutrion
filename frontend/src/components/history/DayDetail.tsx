import { Card, Badge, SourceBadge, type BadgeTone } from "@/components/ui";
import { PencilIcon, TrashIcon } from "@/components/icons";
import { formatDateLong, formatNumber } from "@/lib/format";
import {
  calendarLabel,
  calendarStatus,
  type CalendarStatus,
} from "@/lib/history";
import { buildDailyTotals } from "@/lib/nutrition";
import type { IntakeEntry, NutritionTargets } from "@/lib/types";

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
  onEdit,
  onDelete,
}: {
  dateIso: string;
  entries: IntakeEntry[];
  targets: NutritionTargets;
  onEdit: (entry: IntakeEntry) => void;
  onDelete: (id: string) => void;
}) {
  const totals = buildDailyTotals(dateIso, entries, targets);
  const status = calendarStatus(totals, targets);
  const nonWater = entries
    .filter((e) => e.type !== "water")
    .sort((a, b) => (a.loggedAt < b.loggedAt ? -1 : 1));
  const estimated = nonWater.filter((e) => e.source === "ai").length;

  return (
    <Card className="self-start p-5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[16px] font-extrabold text-ink">
          {formatDateLong(dateIso)}
        </span>
        <Badge tone={statusTone[status]}>{calendarLabel[status]}</Badge>
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
              sub={`/ ${targets.addedSugar_g} g`}
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
            {estimated > 0 ? ` · ${estimated} estimated` : " · all confirmed"}
          </div>

          <ul>
            {nonWater.map((entry, i) => (
              <li
                key={entry.id}
                className={`flex items-center gap-2.5 py-2.5 ${
                  i < nonWater.length - 1 ? "border-b border-line" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-ink">
                      {entry.name}
                    </span>
                    <SourceBadge source={entry.source} />
                  </div>
                </div>
                <span className="text-[11.5px] font-semibold text-ink-3">
                  {formatNumber(entry.nutrients.calories)} kcal
                </span>
                <button
                  onClick={() => onEdit(entry)}
                  aria-label={`Edit ${entry.name}`}
                  className="text-ink-3 hover:text-navy"
                >
                  <PencilIcon size={15} />
                </button>
                <button
                  onClick={() => onDelete(entry.id)}
                  aria-label={`Delete ${entry.name}`}
                  className="text-ink-3 hover:text-red-d"
                >
                  <TrashIcon size={15} />
                </button>
              </li>
            ))}
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
    accent === "amber" ? "text-amber-d" : accent === "blue" ? "text-blue-d" : "text-ink-3";
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
