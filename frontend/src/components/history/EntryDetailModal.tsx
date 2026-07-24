"use client";

import { SourceBadge } from "@/components/ui";
import { CupIcon, UtensilsIcon, XIcon } from "@/components/icons";
import { formatNumber, formatTime } from "@/lib/format";
import type { IntakeEntry } from "@/lib/types";
import { cn } from "@/lib/cn";

export function EntryDetailModal({
  entry,
  onClose,
}: {
  entry: IntakeEntry;
  onClose: () => void;
}) {
  const isDrink = entry.type === "drink" || entry.type === "water";
  const TypeIcon = isDrink ? CupIcon : UtensilsIcon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={entry.name}
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in w-full max-w-[420px] overflow-hidden rounded-card-lg border border-line bg-card shadow-card-lg"
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
              isDrink ? "bg-blue-t text-blue-d" : "bg-teal-t text-teal-d",
            )}
          >
            <TypeIcon size={12} />
            {isDrink ? "Drink" : "Food"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-app-bg text-ink-2 hover:text-ink"
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="mx-5 mt-4 flex h-40 items-center justify-center overflow-hidden rounded-card border border-dashed border-line-2 bg-[repeating-linear-gradient(-45deg,transparent,transparent_8px,rgba(255,255,255,0.03)_8px,rgba(255,255,255,0.03)_16px)]">
          <span className="font-mono text-[12px] text-ink-3">
            {isDrink ? "drink photo" : "food photo"}
          </span>
        </div>

        <div className="px-5 pb-5 pt-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-[22px] font-bold leading-tight text-ink">
              {entry.name}
            </h2>
            <SourceBadge source={entry.source} />
          </div>
          <p className="mt-1 text-[12.5px] font-medium text-ink-3">
            Logged at {formatTime(entry.loggedAt)}
            {entry.portion ? ` · ${entry.portion}` : ""}
            {entry.volumeMl ? ` · ${Math.round(entry.volumeMl)} ml` : ""}
          </p>

          <div className="mt-4 font-display text-[28px] font-bold text-ink">
            {formatNumber(entry.nutrients.calories)}{" "}
            <span className="text-[16px] font-semibold text-ink-2">kcal</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Metric
              label="Added sugar"
              value={`${Math.round(entry.nutrients.addedSugar_g)} g`}
            />
            <Metric
              label="Carbs"
              value={`${Math.round(entry.nutrients.carbs_g)} g`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card-sm bg-app-bg px-3.5 py-3">
      <div className="text-[11px] font-semibold text-ink-3">{label}</div>
      <div className="mt-1 font-display text-[18px] font-bold text-ink">
        {value}
      </div>
    </div>
  );
}
