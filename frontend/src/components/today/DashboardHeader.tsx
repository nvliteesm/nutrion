import { firstName, formatDateLong, greeting } from "@/lib/format";
import { FlameIcon } from "@/components/icons";

export function DashboardHeader({
  fullName,
  dateIso,
  streakDays,
}: {
  fullName: string;
  dateIso: string;
  streakDays: number;
}) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[12.5px] font-semibold text-ink-3">
          {formatDateLong(dateIso)}
        </div>
        <h1 className="mt-0.5 text-[21px] font-extrabold leading-tight tracking-tight text-ink md:text-[26px]">
          {greeting()}, {firstName(fullName)}
        </h1>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-[11px] bg-white px-3 py-2 text-[12px] font-bold text-amber-d shadow-card">
        <FlameIcon size={14} />
        {streakDays}-day streak
      </span>
    </div>
  );
}
