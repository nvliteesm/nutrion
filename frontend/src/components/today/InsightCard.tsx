import { BulbIcon } from "@/components/icons";

export function InsightCard({
  insight,
  confirmedCount,
}: {
  insight: string;
  confirmedCount: number;
}) {
  return (
    <div className="flex flex-col rounded-card-lg bg-gradient-to-br from-navy to-navy-2 p-4 md:p-5">
      <div className="mb-2 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] bg-white/[0.14] text-teal">
          <BulbIcon size={15} />
        </span>
        <span className="text-[10.5px] font-bold tracking-wide text-white/70 md:text-[12px]">
          TODAY&rsquo;S INSIGHT
        </span>
      </div>

      <p className="text-[13.5px] font-semibold leading-relaxed text-white md:text-[15px]">
        {insight}
      </p>

      <div className="mt-auto pt-4 text-[11.5px] font-medium text-white/55">
        Based on {confirmedCount} confirmed{" "}
        {confirmedCount === 1 ? "entry" : "entries"} today
      </div>
    </div>
  );
}
