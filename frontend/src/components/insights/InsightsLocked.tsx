import Link from "next/link";
import { Card } from "@/components/ui";
import { CheckIcon, SparkleIcon } from "@/components/icons";

const perks = [
  "Pattern & correlation detection",
  "AI assistant & personal reports",
  "Medical-report context",
];

/** Free-tier locked state: a blurred teaser plus the upgrade panel. */
export function InsightsLocked() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[24px]">
        Insights
      </h1>

      <Card className="relative overflow-hidden p-[18px]">
        <div className="pointer-events-none select-none opacity-55 blur-[4px]">
          <div className="mb-2 text-[10.5px] font-bold tracking-wide text-ink-3">
            PATTERN DETECTED
          </div>
          <p className="mb-3.5 text-[14px] font-semibold leading-relaxed text-ink">
            You had a sweetened drink after 3 PM on 5 of the last 7 days.
          </p>
          <div className="h-2 rounded-full bg-line">
            <div className="h-full w-[58%] rounded-full bg-teal" />
          </div>
        </div>
      </Card>

      <div className="rounded-card-lg bg-gradient-to-br from-navy to-navy-2 p-6 text-center">
        <span className="mb-3.5 inline-flex h-[52px] w-[52px] items-center justify-center rounded-[16px] bg-amber text-navy-ink">
          <SparkleIcon size={26} />
        </span>
        <h2 className="mb-2 text-[18px] font-extrabold text-white">
          Unlock AI insights
        </h2>
        <p className="mx-auto mb-4 max-w-[320px] text-[13px] font-medium leading-relaxed text-white/70">
          See patterns, correlations, top sugar sources and 30- / 90-day trends
          from your confirmed logs.
        </p>
        <div className="mx-auto mb-5 flex max-w-[280px] flex-col gap-2.5 text-left">
          {perks.map((perk) => (
            <span
              key={perk}
              className="flex items-center gap-2.5 text-[12.5px] font-semibold text-white"
            >
              <CheckIcon size={15} className="text-teal" />
              {perk}
            </span>
          ))}
        </div>
        <Link
          href="/premium"
          className="mx-auto block max-w-[280px] rounded-card-sm bg-teal py-3 text-[14px] font-bold text-navy-ink"
        >
          Go Premium
        </Link>
        <div className="mt-3 text-[11.5px] font-medium text-white/55">
          History &amp; calendar stay free, always.
        </div>
      </div>
    </div>
  );
}
