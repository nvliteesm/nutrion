"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { CupIcon, PlusIcon, UtensilsIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { ScanCaptureSheet } from "@/components/scan/ScanCaptureSheet";

export function QuickActions({ delay = 0 }: { delay?: number }) {
  const [captureKind, setCaptureKind] = useState<"drink" | "food" | null>(
    null,
  );

  const cards = [
    {
      kind: "drink" as const,
      title: "Drink",
      blurb: "Camera or gallery scan",
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
      kind: "food" as const,
      title: "Food",
      blurb: "Camera or gallery scan",
      icon: UtensilsIcon,
      accent: "border-teal/25 bg-teal-t text-teal-d",
      iconWrap: "bg-teal text-white",
      hover:
        "hover:border-teal hover:bg-teal hover:text-navy-ink hover:shadow-[0_8px_24px_rgba(18,184,134,0.35)]",
      titleClass: "group-hover:text-navy-ink",
      blurbClass: "group-hover:text-navy-ink/75",
      iconHover: "group-hover:bg-white group-hover:text-teal",
    },
  ] as const;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((action, i) => {
          const Icon = action.icon;
          return (
            <button
              key={action.kind}
              type="button"
              className="group text-left"
              onClick={() => {
                window.scrollTo(0, 0);
                setCaptureKind(action.kind);
              }}
            >
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
            </button>
          );
        })}

        <Link href="/scan/manual" className="group">
          <Card
            delay={delay + 0.1}
            className={cn(
              "flex h-full items-center gap-3 border border-amber/25 bg-amber-t p-4 text-amber-d transition-colors duration-200",
              "hover:border-amber hover:bg-amber hover:text-navy-ink hover:shadow-[0_8px_24px_rgba(239,160,42,0.4)]",
            )}
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-amber text-white transition-colors duration-200 group-hover:bg-white group-hover:text-amber-d">
              <PlusIcon size={20} />
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold text-ink transition-colors duration-200 group-hover:text-navy-ink">
                Add manually
              </div>
              <p className="mt-0.5 text-[12px] font-medium text-ink-2 transition-colors duration-200 group-hover:text-navy-ink/75">
                Type in a meal or drink
              </p>
            </div>
          </Card>
        </Link>
      </div>

      <ScanCaptureSheet
        open={captureKind != null}
        kind={captureKind}
        onClose={() => setCaptureKind(null)}
        showManual={false}
      />
    </>
  );
}
