import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  calendarColor,
  calendarLabel,
  type CalendarStatus,
  type DayCell,
} from "@/lib/history";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const LEGEND: CalendarStatus[] = [
  "within",
  "moderate",
  "significant",
  "incomplete",
  "none",
];

export function MonthCalendar({
  monthLabel,
  cells,
  selectedIso,
  todayIso,
  onSelect,
  onPrev,
  onNext,
}: {
  monthLabel: string;
  cells: DayCell[];
  selectedIso: string;
  todayIso: string;
  onSelect: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <Card className="p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[14px] font-bold text-ink">{monthLabel}</span>
        <div className="flex items-center gap-4 text-[16px] font-bold text-ink-3">
          <button onClick={onPrev} aria-label="Previous month" className="px-1">
            ‹
          </button>
          <button onClick={onNext} aria-label="Next month" className="px-1">
            ›
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-ink-3">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => {
          if (cell.day === null || cell.dateIso === null) {
            return <div key={i} className="aspect-square" />;
          }
          const isSelected = cell.dateIso === selectedIso;
          const isToday = cell.dateIso === todayIso;
          return (
            <button
              key={i}
              onClick={() => !cell.isFuture && onSelect(cell.dateIso!)}
              disabled={cell.isFuture}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-[11px] text-[13px] font-semibold",
                cell.isFuture ? "text-ink-3" : "text-ink",
                isSelected && "border-2 border-navy text-navy",
                isToday && !isSelected && "ring-1 ring-navy/30",
              )}
            >
              {cell.day}
              {cell.status && cell.status !== "none" && (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    calendarColor[cell.status],
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 border-t border-line pt-3.5">
        {LEGEND.map((status) => (
          <span
            key={status}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-2"
          >
            <span className={cn("h-2.5 w-2.5 rounded-full", calendarColor[status])} />
            {calendarLabel[status]}
          </span>
        ))}
      </div>
    </Card>
  );
}
