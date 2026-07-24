"use client";

import { useState } from "react";
import { Card, Button, ConfidenceBadge, SourceBadge } from "@/components/ui";
import { AlertTriangleIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import { MOCK_TODAY } from "@/lib/mock-data";
import type { ExtractedDrink, IntakeEntry } from "@/lib/types";

type ConsumedMode = "whole" | "half" | "custom";

function nowOnToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${MOCK_TODAY}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export function ReviewStep({
  drink,
  onConfirm,
}: {
  drink: ExtractedDrink;
  onConfirm: (entry: Omit<IntakeEntry, "id">) => void;
}) {
  const [name, setName] = useState(drink.productName);
  const [servingMl, setServingMl] = useState(drink.servingSizeMl);
  const [perContainer, setPerContainer] = useState(drink.servingsPerContainer);
  const [calories, setCalories] = useState(drink.caloriesPerServing);
  const [carbs, setCarbs] = useState(drink.carbs_g);
  const [totalSugar, setTotalSugar] = useState(drink.totalSugar_g);
  const [addedSugar, setAddedSugar] = useState(drink.addedSugar_g);
  const [caffeine, setCaffeine] = useState(drink.caffeine_mg ?? 0);

  const [mode, setMode] = useState<ConsumedMode>("whole");
  const [customMl, setCustomMl] = useState(servingMl);

  const containerMl = servingMl * perContainer;
  const consumedMl =
    mode === "whole" ? containerMl : mode === "half" ? containerMl / 2 : customMl;
  const servingsConsumed = servingMl > 0 ? consumedMl / servingMl : 0;

  const scaled = {
    calories: calories * servingsConsumed,
    carbs_g: carbs * servingsConsumed,
    totalSugar_g: totalSugar * servingsConsumed,
    addedSugar_g: addedSugar * servingsConsumed,
    caffeine_mg: caffeine * servingsConsumed,
  };

  const sugarIsLowConf = drink.lowConfidenceFields.includes("addedSugar_g");

  function handleConfirm() {
    onConfirm({
      type: "drink",
      name: name.trim() || "Drink",
      loggedAt: nowOnToday(),
      source: "label",
      confidence: drink.confidence,
      confirmed: true,
      portion: `${formatNumber(consumedMl)} ml`,
      volumeMl: Math.round(consumedMl),
      nutrients: {
        calories: Math.round(scaled.calories),
        carbs_g: Math.round(scaled.carbs_g),
        totalSugar_g: Math.round(scaled.totalSugar_g),
        addedSugar_g: Math.round(scaled.addedSugar_g),
        protein_g: 0,
        fat_g: 0,
        caffeine_mg: Math.round(scaled.caffeine_mg),
      },
    });
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2.5 text-[14px] font-bold text-ink-3">
        <span>Scan</span>
        <span>›</span>
        <span className="text-ink">Review &amp; confirm</span>
      </div>
      <h1 className="mb-4 text-[22px] font-extrabold tracking-tight text-ink">
        Check the values before saving
      </h1>

      <div className="grid gap-5 md:grid-cols-[1fr_340px] md:items-start">
        {/* Extracted values */}
        <Card className="p-5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent text-[15px] font-bold text-ink hover:border-line focus:border-teal focus:outline-none"
            />
            <ConfidenceBadge confidence={drink.confidence} />
          </div>
          <div className="mb-3.5 flex items-center gap-2">
            <SourceBadge source="label" />
            <span className="text-[12px] font-medium text-ink-3">
              Tap any value to edit
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <EditableStat label="Serving size" value={servingMl} onChange={setServingMl} suffix="ml" />
            <EditableStat label="Servings / container" value={perContainer} onChange={setPerContainer} />
            <EditableStat label="Calories / serving" value={calories} onChange={setCalories} suffix="kcal" />
            <EditableStat label="Total carbs" value={carbs} onChange={setCarbs} suffix="g" />
            <EditableStat label="Total sugar" value={totalSugar} onChange={setTotalSugar} suffix="g" />
            <EditableStat
              label="Added sugar"
              value={addedSugar}
              onChange={setAddedSugar}
              suffix="g"
              highlight={sugarIsLowConf}
            />
            <EditableStat label="Caffeine" value={caffeine} onChange={setCaffeine} suffix="mg" />
          </div>

          {sugarIsLowConf && (
            <div className="mt-3.5 flex items-start gap-2 rounded-[11px] bg-amber-t px-3 py-2.5">
              <AlertTriangleIcon size={15} className="mt-px shrink-0 text-amber-d" />
              <p className="text-[11.5px] font-medium leading-relaxed text-amber-d">
                Added sugar was harder to read — please confirm it against the
                printed label.
              </p>
            </div>
          )}
        </Card>

        {/* Consumed + summary */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="mb-3 text-[14px] font-bold text-ink">
              How much did you drink?
            </div>
            <div className="mb-3.5 flex gap-2">
              <ModeButton active={mode === "whole"} onClick={() => setMode("whole")}>
                Whole
              </ModeButton>
              <ModeButton active={mode === "half"} onClick={() => setMode("half")}>
                Half
              </ModeButton>
              <ModeButton active={mode === "custom"} onClick={() => setMode("custom")}>
                Custom
              </ModeButton>
            </div>

            {mode === "custom" ? (
              <label className="mb-2 flex items-center justify-between gap-2 rounded-[11px] border border-line px-3 py-2.5">
                <span className="text-[12.5px] font-semibold text-ink-2">
                  Amount (ml)
                </span>
                <input
                  type="number"
                  value={customMl}
                  onChange={(e) => setCustomMl(Number(e.target.value) || 0)}
                  className="w-24 bg-transparent text-right text-[13.5px] font-bold text-ink focus:outline-none"
                />
              </label>
            ) : (
              <div className="mb-2 flex items-center justify-between rounded-[11px] border border-line px-3 py-2.5">
                <span className="text-[12.5px] font-semibold text-ink-2">Amount</span>
                <span className="text-[13.5px] font-bold text-ink">
                  {formatNumber(consumedMl)} ml · {servingsConsumed.toFixed(2)} serving
                </span>
              </div>
            )}

            <p className="text-[11px] font-medium leading-relaxed text-ink-3">
              One container isn&rsquo;t always one serving — we base totals on what
              you actually drank.
            </p>
          </Card>

          <Card className="p-5">
            <div className="mb-2.5 text-[12px] font-bold text-ink-3">You&rsquo;ll log</div>
            <SummaryRow label="Calories" value={`${formatNumber(scaled.calories)} kcal`} border />
            <SummaryRow label="Added sugar" value={`${formatNumber(scaled.addedSugar_g)} g`} border />
            <SummaryRow label="Caffeine" value={`${formatNumber(scaled.caffeine_mg)} mg`} />
          </Card>

          <Button size="lg" fullWidth onClick={handleConfirm}>
            Confirm &amp; save entry
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditableStat({
  label,
  value,
  onChange,
  suffix,
  highlight,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        highlight ? "border-[1.5px] border-amber bg-amber-t" : "border-line"
      }`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-[11px] font-semibold ${highlight ? "text-amber-d" : "text-ink-3"}`}
        >
          {label}
        </span>
        {highlight && (
          <span className="text-[8.5px] font-bold uppercase tracking-wide text-amber-d">
            Check
          </span>
        )}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full min-w-0 bg-transparent text-[15px] font-bold text-ink focus:outline-none"
        />
        {suffix && (
          <span className="text-[11px] font-semibold text-ink-3">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-[10px] py-2.5 text-center text-[12.5px] font-bold transition-colors ${
        active
          ? "bg-navy text-white"
          : "border border-line-2 font-semibold text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryRow({
  label,
  value,
  border,
}: {
  label: string;
  value: string;
  border?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-1.5 ${border ? "border-b border-line" : ""}`}
    >
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      <span className="text-[13px] font-bold text-ink">{value}</span>
    </div>
  );
}
