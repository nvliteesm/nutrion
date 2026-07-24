"use client";

export interface BarItem {
  label: string;
  /** Display string under the bar, e.g. "1,240 mg". */
  display: string;
  /** 0–100 fill percent. */
  percent: number;
  colorClass?: string;
}

/**
 * Compact horizontal comparison bars (no chart library).
 */
export function BarChart({
  items,
  height = 10,
}: {
  items: BarItem[];
  height?: number;
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-[12px] font-medium text-ink-3">
        No data for this period.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-[12.5px] font-bold text-ink">{item.label}</span>
            <span className="text-[12px] font-semibold text-ink-2">{item.display}</span>
          </div>
          <div
            className="w-full overflow-hidden rounded-full bg-line"
            style={{ height }}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${item.colorClass ?? "bg-teal"}`}
              style={{ width: `${Math.max(2, Math.min(100, item.percent))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
