"use client";

import { useRouter } from "next/navigation";
import { Badge, Button, Card } from "@/components/ui";
import {
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  CupIcon,
  DownloadIcon,
  FileTextIcon,
  SearchIcon,
  SendIcon,
  SparkleIcon,
} from "@/components/icons";
import { getStoredSession, storeSession } from "@/lib/auth";

const FREE_FEATURES = [
  "Registration and profile",
  "Manual food, drink, and water logging",
  "Limited nutrition scans",
  "Daily dashboard + target tracking",
  "Daily dashboard + calendar",
  "Edit and delete previous entries",
  "Basic 7-day summaries",
  "Basic reminders",
];

const PREMIUM_OUTCOMES = [
  { icon: <ChartIcon size={16} />, text: "Understand long-term nutrition patterns" },
  { icon: <FileTextIcon size={16} />, text: "Analyze confirmed medical results" },
  { icon: <SearchIcon size={16} />, text: "Ask questions about nutrition history" },
  { icon: <SparkleIcon size={16} />, text: "Receive personalized weekly insights" },
  { icon: <DownloadIcon size={16} />, text: "Generate downloadable reports" },
  { icon: <SendIcon size={16} />, text: "Receive Telegram reminders" },
];

export default function PremiumPage() {
  const router = useRouter();
  const session = getStoredSession();
  const isPremium = session?.subscription === "premium";

  function togglePremium() {
    if (!session) return;
    const updated = {
      ...session,
      subscription: isPremium ? ("free" as const) : ("premium" as const),
    };
    storeSession(updated);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="mb-6 text-center">
        <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-[16px] bg-amber text-navy-ink">
          <SparkleIcon size={28} />
        </span>
        <h1 className="text-[24px] font-extrabold tracking-tight text-ink">
          NutriON Premium
        </h1>
        <p className="mx-auto mt-2 max-w-[380px] text-[13px] font-medium leading-relaxed text-ink-2">
          Premium extends your tracking with AI-powered insights, medical context
          and personalised reports — all educational, never a diagnosis.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {/* Free column */}
        <Card className="p-5">
          <div className="mb-3 text-[14px] font-bold text-ink">Free</div>
          <ul className="flex flex-col gap-2.5">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[12.5px] font-medium text-ink-2">
                <CheckIcon size={14} className="mt-0.5 shrink-0 text-teal" />
                {f}
              </li>
            ))}
          </ul>
        </Card>

        {/* Premium column */}
        <Card className="relative overflow-hidden border border-amber/30 p-5">
          <Badge tone="amber" className="absolute right-4 top-4">
            RECOMMENDED
          </Badge>
          <div className="mb-3 text-[14px] font-bold text-ink">Premium</div>
          <ul className="flex flex-col gap-2.5">
            {PREMIUM_OUTCOMES.map(({ icon, text }) => (
              <li key={text} className="flex items-start gap-2.5 text-[12.5px] font-semibold text-ink">
                <span className="mt-0.5 shrink-0 text-teal">{icon}</span>
                {text}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Demo toggle (hackathon) */}
      <Card className="p-5 text-center">
        <div className="mb-2 text-[11px] font-bold tracking-wide text-ink-3">
          HACKATHON DEMO
        </div>
        <p className="mb-3.5 text-[13px] font-medium text-ink-2">
          No payment system is connected. Toggle your subscription to preview
          both experiences.
        </p>
        <Button
          variant={isPremium ? "outline" : "primary"}
          size="lg"
          onClick={togglePremium}
        >
          {isPremium ? "Switch to Free" : "Activate Premium"}
        </Button>
        <div className="mt-2 text-[11px] font-medium text-ink-3">
          {isPremium
            ? "You're currently on Premium."
            : "You're currently on the Free plan."}
        </div>
      </Card>

      <p className="mt-6 text-center text-[11.5px] font-medium leading-relaxed text-ink-3">
        Today&apos;s calendar stays free, always. NutriON does not diagnose,
        prescribe treatment, or guarantee health improvement.
      </p>
    </div>
  );
}
