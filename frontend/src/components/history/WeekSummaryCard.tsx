import { Card } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import type { WeekSummary } from "@/lib/history";

export function WeekSummaryCard({ summary }: { summary: WeekSummary }) {
  return (
    <Card className="p-4 md:p-[18px]">
      <div className="mb-2.5 text-[12px] font-bold tracking-wide text-ink-3">
        LAST 7 DAYS
      </div>
      <div className="grid grid-cols-3 gap-3.5">
        <Stat value={formatNumber(summary.avgCalories)} label="avg kcal / day" />
        <Stat value={`${summary.avgSugar} g`} label="avg total sugar" />
        <Stat
          value={`${summary.daysWithinTarget} / ${summary.daysConsidered}`}
          label="days within target"
          accent
        />
      </div>
    </Card>
  );
}

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className={`text-[20px] font-extrabold ${accent ? "text-teal-d" : "text-ink"}`}>
        {value}
      </div>
      <div className="text-[11px] font-semibold text-ink-3">{label}</div>
    </div>
  );
}
