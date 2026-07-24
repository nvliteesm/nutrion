import { Card, SourceBadge } from "@/components/ui";
import { CupIcon, DropletIcon, UtensilsIcon } from "@/components/icons";
import { formatNumber, formatTime } from "@/lib/format";
import type { EntryType, IntakeEntry } from "@/lib/types";

const typeIcon: Record<EntryType, typeof CupIcon> = {
  food: UtensilsIcon,
  drink: CupIcon,
  water: DropletIcon,
};

const typeStyles: Record<EntryType, string> = {
  food: "bg-teal-t text-teal-d",
  drink: "bg-blue-t text-blue-d",
  water: "bg-blue-t text-blue-d",
};

function calorieLabel(entry: IntakeEntry): string {
  if (entry.caloriesRange) {
    const [lo, hi] = entry.caloriesRange;
    return `${formatNumber(lo)}–${formatNumber(hi)}`;
  }
  return `${formatNumber(entry.nutrients.calories)} kcal`;
}

export function RecentEntries({ entries }: { entries: IntakeEntry[] }) {
  // Water is represented by the hydration card, so keep this list to food & drink.
  const visible = entries.filter((e) => e.type !== "water").slice(0, 4);

  return (
    <Card className="p-4 md:p-5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[14px] font-bold text-ink">Recent entries</span>
      </div>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-[13px] font-medium text-ink-3">
          Nothing logged yet today.
        </p>
      ) : (
        <ul>
          {visible.map((entry, i) => {
            const Icon = typeIcon[entry.type];
            return (
              <li
                key={entry.id}
                className={`flex items-center gap-3 py-2.5 ${
                  i < visible.length - 1 ? "border-b border-line" : ""
                }`}
              >
                <span
                  className={`inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] ${typeStyles[entry.type]}`}
                >
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-ink">
                    {entry.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[11.5px] font-medium text-ink-3">
                      {formatTime(entry.loggedAt)}
                    </span>
                    <SourceBadge source={entry.source} />
                  </div>
                </div>
                <span className="text-[13px] font-bold text-ink">
                  {calorieLabel(entry)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
