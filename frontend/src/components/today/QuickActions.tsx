"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { CupIcon, PlusIcon, UtensilsIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

const actions = [
  {
    href: "/scan?mode=drink",
    title: "Drink",
    blurb: "Scan a label or estimate it",
    icon: CupIcon,
    accent: "border-blue/25 bg-blue-t text-blue-d",
    iconWrap: "bg-blue text-white",
  },
  {
    href: "/scan?mode=food",
    title: "Food",
    blurb: "Snap a meal to estimate it",
    icon: UtensilsIcon,
    accent: "border-line bg-card text-ink-2",
    iconWrap: "bg-app-bg text-ink",
  },
  {
    href: "/scan/manual",
    title: "Add manually",
    blurb: "Type in a meal or drink",
    icon: PlusIcon,
    accent: "border-line bg-card text-ink-2",
    iconWrap: "bg-app-bg text-ink",
  },
] as const;

export function QuickActions() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.href} href={action.href}>
            <Card
              className={cn(
                "flex h-full items-center gap-3 border p-4 transition hover:shadow-card-lg",
                action.accent,
              )}
            >
              <span
                className={cn(
                  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]",
                  action.iconWrap,
                )}
              >
                <Icon size={20} />
              </span>
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold text-ink">
                  {action.title}
                </div>
                <p className="mt-0.5 text-[12px] font-medium text-ink-2">
                  {action.blurb}
                </p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
