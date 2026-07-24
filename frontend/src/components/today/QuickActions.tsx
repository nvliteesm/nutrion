"use client";

import Link from "next/link";
import { Card, useToast } from "@/components/ui";
import {
  CupIcon,
  DropletIcon,
  PlusIcon,
  UtensilsIcon,
} from "@/components/icons";

interface LinkAction {
  label: string;
  href: string;
  icon: typeof CupIcon;
  iconBg: string;
  iconColor: string;
  tap?: false;
}

const linkActions: LinkAction[] = [
  {
    label: "Scan food",
    href: "/scan?mode=food",
    icon: UtensilsIcon,
    iconBg: "bg-teal-t",
    iconColor: "text-teal-d",
  },
  {
    label: "Scan drink",
    href: "/scan?mode=drink",
    icon: CupIcon,
    iconBg: "bg-blue-t",
    iconColor: "text-blue-d",
  },
  {
    label: "Add manually",
    href: "/scan/manual",
    icon: PlusIcon,
    iconBg: "bg-navy/[0.06]",
    iconColor: "text-navy",
  },
];

export function QuickActions() {
  const { toast } = useToast();

  async function addWater() {
    try {
      const res = await fetch("/memory/intakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: "default",
          meal: {
            name: "Water",
            serving: "1 cup (250 ml)",
            nutrients: {
              calories: 0,
              protein_g: 0,
              carbs_g: 0,
              fat_g: 0,
              fiber_g: 0,
              sugar_g: 0,
              sodium_mg: 0,
            },
            source: "manual",
            confidence: 1.0,
          },
        }),
      });
      if (res.ok) {
        toast({ title: "Water added", description: "+1 cup (250 ml)", variant: "success" });
      } else {
        toast({ title: "Couldn't save", description: "Try again", variant: "error" });
      }
    } catch {
      toast({ title: "Offline", description: "Backend unreachable", variant: "error" });
    }
  }

  return (
    <div className="grid grid-cols-4 gap-2.5 md:gap-3">
      {linkActions.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.label} href={action.href}>
            <Card className="flex h-full flex-col items-center gap-2 p-3 transition-shadow hover:shadow-card-lg md:flex-row md:gap-3 md:p-4">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-[11px] ${action.iconBg} ${action.iconColor} shrink-0`}
              >
                <Icon size={19} />
              </span>
              <span className="text-center text-[10px] font-bold text-ink-2 md:text-left md:text-[13px] md:text-ink">
                {action.label}
              </span>
            </Card>
          </Link>
        );
      })}

      {/* One-tap water — no form, no navigation */}
      <button onClick={addWater} type="button">
        <Card className="flex h-full flex-col items-center gap-2 p-3 transition-shadow hover:shadow-card-lg md:flex-row md:gap-3 md:p-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-blue-t text-blue-d">
            <DropletIcon size={19} />
          </span>
          <span className="text-center text-[10px] font-bold text-ink-2 md:text-left md:text-[13px] md:text-ink">
            Add water
          </span>
        </Card>
      </button>
    </div>
  );
}
