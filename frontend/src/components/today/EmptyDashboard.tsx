import Link from "next/link";
import { Card } from "@/components/ui";
import {
  CupIcon,
  DropletIcon,
  PlusIcon,
  UtensilsIcon,
} from "@/components/icons";
import { firstName, greeting } from "@/lib/format";

const actions = [
  { label: "Scan drink label", href: "/scan/drink", icon: CupIcon, cls: "bg-blue-t text-blue-d" },
  { label: "Scan food", href: "/scan/food", icon: UtensilsIcon, cls: "bg-app-bg text-ink" },
  { label: "Add manually", href: "/scan/manual", icon: PlusIcon, cls: "bg-navy/[0.06] text-navy" },
  { label: "Add water", href: "/scan/manual", icon: DropletIcon, cls: "bg-blue-t text-blue-d" },
];

/** Friendly first-run state when nothing is logged today yet. */
export function EmptyDashboard({ fullName }: { fullName: string }) {
  return (
    <div className="flex animate-fade-up flex-col gap-5">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[26px]">
          {greeting()}, {firstName(fullName)}
        </h1>
        <p className="mt-1 text-[14px] font-medium text-ink-2">
          Nothing logged yet today. Add your first entry to start tracking.
        </p>
      </div>

      <Card className="flex flex-col items-center gap-1 px-6 py-10 text-center">
        <span className="mb-2 inline-flex h-14 w-14 items-center justify-center rounded-[16px] bg-teal-t text-teal-d">
          <PlusIcon size={28} />
        </span>
        <div className="text-[16px] font-bold text-ink">Log your first entry</div>
        <p className="max-w-[320px] text-[13px] font-medium text-ink-2">
          Scan a drink label for accurate values, snap a meal, or enter something
          manually — you always review before it&rsquo;s saved.
        </p>

        <div className="mt-5 grid w-full max-w-[420px] grid-cols-2 gap-2.5">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Link key={a.label} href={a.href}>
                <div className="flex items-center gap-2.5 rounded-card border border-line px-3 py-3 text-left transition-shadow hover:shadow-card">
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${a.cls}`}>
                    <Icon size={18} />
                  </span>
                  <span className="text-[12.5px] font-bold text-ink">{a.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
