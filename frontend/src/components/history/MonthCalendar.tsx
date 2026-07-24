"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
  delay = 0,
}: {
  monthLabel: string;
  cells: DayCell[];
  selectedIso: string;
  todayIso: string;
  onSelect: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
  delay?: number;
}) {
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);

  // Pad to 42 so the grid is always 6×7 (constant size).
  const gridCells =
    cells.length >= 42
      ? cells.slice(0, 42)
      : [
          ...cells,
          ...Array.from({ length: 42 - cells.length }, () => ({
            day: null,
            dateIso: null,
            status: null,
            isFuture: false,
            sugar_g: null,
            sugarTarget_g: null,
          })),
        ];

  return (
    <Card className="w-full shrink-0 p-4 md:p-5" delay={delay} quiet>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[14px] font-bold text-ink">{monthLabel}</span>
        <div className="flex items-center gap-4 text-[16px] font-bold text-ink-3">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous month"
            className="px-1"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next month"
            className="px-1"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-ink-3">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="h-5 leading-5">
            {d}
          </span>
        ))}
      </div>

      {/* Fixed cell height — no aspect-ratio reflow on select */}
      <div className="relative grid grid-cols-7 grid-rows-6 gap-1">
        {gridCells.map((cell, i) => {
          if (cell.day === null || cell.dateIso === null) {
            return <div key={i} className="h-10 md:h-11" />;
          }
          const isSelected = cell.dateIso === selectedIso;
          const isToday = cell.dateIso === todayIso;
          const hasDot = Boolean(cell.status && cell.status !== "none");
          const col = i % 7;
          const showTip = hoveredIso === cell.dateIso && !cell.isFuture;

          return (
            <div key={i} className="relative">
              <button
                type="button"
                onClick={() => !cell.isFuture && onSelect(cell.dateIso!)}
                onMouseEnter={() =>
                  !cell.isFuture && setHoveredIso(cell.dateIso)
                }
                onMouseLeave={() => setHoveredIso(null)}
                onFocus={() => !cell.isFuture && setHoveredIso(cell.dateIso)}
                onBlur={() => setHoveredIso(null)}
                disabled={cell.isFuture}
                className={cn(
                  "box-border flex h-10 w-full flex-col items-center justify-center gap-0.5 rounded-[10px] border-2 text-[13px] font-semibold transition-colors md:h-11",
                  cell.isFuture ? "text-ink-3" : "text-ink hover:bg-teal-t",
                  isSelected ? "border-teal text-teal-d" : "border-transparent",
                  isToday && !isSelected && "ring-1 ring-teal/30",
                )}
              >
                <span className="leading-none">{cell.day}</span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    hasDot ? calendarColor[cell.status!] : "bg-transparent",
                  )}
                />
              </button>

              <AnimatePresence>
                {showTip && (
                  <motion.div
                    role="tooltip"
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      "pointer-events-none absolute z-20 w-[118px] rounded-[12px] border border-line bg-card px-3 py-2.5 shadow-card-lg",
                      // Flip near right edge so the tip stays on-screen
                      col >= 5 ? "right-0" : "left-0",
                      "bottom-[calc(100%+6px)]",
                    )}
                  >
                    <div className="text-[10px] font-bold tracking-wide text-amber-d">
                      SUGAR
                    </div>
                    <div className="mt-0.5 text-[18px] font-extrabold leading-none text-ink">
                      {cell.sugar_g ?? 0}
                      <span className="text-[11px] font-bold"> g</span>
                    </div>
                    {cell.sugarTarget_g != null && (
                      <div className="mt-1 text-[10.5px] font-semibold text-ink-3">
                        of {cell.sugarTarget_g} g limit
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 border-t border-line pt-3.5">
        {LEGEND.map((status) => (
          <span
            key={status}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-2"
          >
            <span
              className={cn("h-2.5 w-2.5 rounded-full", calendarColor[status])}
            />
            {calendarLabel[status]}
          </span>
        ))}
      </div>
    </Card>
  );
}
