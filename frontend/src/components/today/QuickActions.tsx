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
    hover:
      "hover:border-blue hover:bg-blue hover:text-white hover:shadow-[0_8px_24px_rgba(62,155,232,0.35)]",
    titleClass: "group-hover:text-white",
    blurbClass: "group-hover:text-white/80",
    iconHover: "group-hover:bg-white group-hover:text-blue",
  },
  {
    href: "/scan?mode=food",
    title: "Food",
    blurb: "Snap a meal to estimate it",
    icon: UtensilsIcon,
    accent: "border-teal/25 bg-teal-t text-teal-d",
    iconWrap: "bg-teal text-white",
    hover:
      "hover:border-teal hover:bg-teal hover:text-navy-ink hover:shadow-[0_8px_24px_rgba(18,184,134,0.35)]",
    titleClass: "group-hover:text-navy-ink",
    blurbClass: "group-hover:text-navy-ink/75",
    iconHover: "group-hover:bg-white group-hover:text-teal",
  },
  {
    href: "/scan/manual",
    title: "Add manually",
    blurb: "Type in a meal or drink",
    icon: PlusIcon,
    accent: "border-amber/25 bg-amber-t text-amber-d",
    iconWrap: "bg-amber text-white",
    hover:
      "hover:border-amber hover:bg-amber hover:text-navy-ink hover:shadow-[0_8px_24px_rgba(239,160,42,0.4)]",
    titleClass: "group-hover:text-navy-ink",
    blurbClass: "group-hover:text-navy-ink/75",
    iconHover: "group-hover:bg-white group-hover:text-amber-d",
  },
] as const;

export function QuickActions({ delay = 0 }: { delay?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {actions.map((action, i) => {
        const Icon = action.icon;
        return (
          <Link key={action.href} href={action.href} className="group">
            <Card
              delay={delay + i * 0.05}
              className={cn(
                "flex h-full items-center gap-3 border p-4 transition-colors duration-200",
                action.accent,
                action.hover,
              )}
            >
              <span
                className={cn(
                  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] transition-colors duration-200",
                  action.iconWrap,
                  action.iconHover,
                )}
              >
                <Icon size={20} />
              </span>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-[15px] font-extrabold text-ink transition-colors duration-200",
                    action.titleClass,
                  )}
                >
                  {action.title}
                </div>
                <p
                  className={cn(
                    "mt-0.5 text-[12px] font-medium text-ink-2 transition-colors duration-200",
                    action.blurbClass,
                  )}
                >
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
