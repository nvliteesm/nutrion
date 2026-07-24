"use client";

import { useState } from "react";
import { Card, Button, Badge } from "@/components/ui";
import { PlusIcon, XIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import { getToday } from "@/lib/date";
import type { DetectedFoodItem, FoodAnalysis, IntakeEntry } from "@/lib/types";

function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function nowOnToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${getToday()}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

let addedCounter = 0;

export function FoodReviewStep({
  analysis,
  onConfirm,
}: {
  analysis: FoodAnalysis;
  onConfirm: (entry: Omit<IntakeEntry, "id">) => void;
}) {
  const [items, setItems] = useState<DetectedFoodItem[]>(analysis.items);

  function changeServings(id: string, delta: number) {
    setItems((list) =>
      list.map((it) =>
        it.id === id
          ? { ...it, servings: Math.max(0.5, Math.round((it.servings + delta) * 2) / 2) }
          : it,
      ),
    );
  }

  function rename(id: string, name: string) {
    setItems((list) => list.map((it) => (it.id === id ? { ...it, name } : it)));
  }

  function removeItem(id: string) {
    setItems((list) => list.filter((it) => it.id !== id));
  }

  function addItem() {
    addedCounter += 1;
    setItems((list) => [
      ...list,
      {
        id: `added_${addedCounter}`,
        name: "New item",
        unit: "serving",
        servings: 1,
        perServingRange: [50, 100],
        perServingNutrients: {
          calories: 75,
          carbs_g: 10,
          totalSugar_g: 2,
          addedSugar_g: 0,
          protein_g: 3,
          fat_g: 2,
        },
      },
    ]);
  }

  const totalLo = Math.round(
    items.reduce((s, it) => s + it.perServingRange[0] * it.servings, 0),
  );
  const totalHi = Math.round(
    items.reduce((s, it) => s + it.perServingRange[1] * it.servings, 0),
  );
  const midpoint = (n: number) => Math.round(n);
  const macros = items.reduce(
    (acc, it) => {
      acc.carbs_g += it.perServingNutrients.carbs_g * it.servings;
      acc.totalSugar_g += it.perServingNutrients.totalSugar_g * it.servings;
      acc.addedSugar_g += it.perServingNutrients.addedSugar_g * it.servings;
      acc.protein_g += it.perServingNutrients.protein_g * it.servings;
      acc.fat_g += it.perServingNutrients.fat_g * it.servings;
      return acc;
    },
    { carbs_g: 0, totalSugar_g: 0, addedSugar_g: 0, protein_g: 0, fat_g: 0 },
  );

  function handleConfirm() {
    onConfirm({
      type: "food",
      name: "Scanned meal",
      loggedAt: nowOnToday(),
      source: "ai",
      confidence: analysis.confidence,
      confirmed: true,
      portion: `${items.length} item${items.length === 1 ? "" : "s"}`,
      caloriesRange: [totalLo, totalHi],
      nutrients: {
        calories: Math.round((totalLo + totalHi) / 2),
        carbs_g: midpoint(macros.carbs_g),
        totalSugar_g: midpoint(macros.totalSugar_g),
        addedSugar_g: midpoint(macros.addedSugar_g),
        protein_g: midpoint(macros.protein_g),
        fat_g: midpoint(macros.fat_g),
      },
    });
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2.5 text-[14px] font-bold text-ink-3">
        <span>Scan food</span>
        <span>›</span>
        <span className="text-ink">Review estimate</span>
      </div>
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink">
          Detected items
        </h1>
        <Badge tone="amber">AI-ESTIMATED NUTRITION</Badge>
      </div>

      <div className="grid gap-5 md:grid-cols-[300px_1fr] md:items-start">
        <div className="flex flex-col gap-3.5">
          <div className="relative h-44 overflow-hidden rounded-card bg-[#221d16] md:h-56">
            <div className="absolute inset-0 flex items-center justify-center text-[12px] font-medium text-white/50">
              Your photo
            </div>
          </div>
          <Card className="p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[12px] font-bold text-ink-3">Estimated total</span>
              <Badge tone="amber">MEDIUM</Badge>
            </div>
            <div className="my-1.5 text-[26px] font-extrabold leading-none text-ink">
              {formatNumber(totalLo)}–{formatNumber(totalHi)}
              <span className="text-[13px] font-semibold text-ink-3"> kcal</span>
            </div>
            <div className="flex justify-between text-[12px] font-semibold text-ink-2">
              <span>C {midpoint(macros.carbs_g)}g</span>
              <span>Sugar {midpoint(macros.totalSugar_g)}g</span>
              <span>P {midpoint(macros.protein_g)}g</span>
            </div>
          </Card>
        </div>

        <Card className="px-5 pb-5 pt-2">
          {items.map((it, i) => {
            const lo = Math.round(it.perServingRange[0] * it.servings);
            const hi = Math.round(it.perServingRange[1] * it.servings);
            return (
              <div
                key={it.id}
                className={`flex items-center gap-3 py-3.5 ${
                  i < items.length - 1 ? "border-b border-line" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <input
                    value={it.name}
                    onChange={(e) => rename(it.id, e.target.value)}
                    className="w-full rounded-md border border-transparent bg-transparent text-[14px] font-bold text-ink hover:border-line focus:border-teal focus:outline-none"
                  />
                  <div className="mt-0.5 text-[12px] font-medium text-ink-3">
                    {formatNumber(lo)}–{formatNumber(hi)} kcal ·{" "}
                    {trimNum(it.servings)} {it.unit}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Stepper label="−" onClick={() => changeServings(it.id, -0.5)} />
                  <span className="min-w-[28px] text-center text-[13px] font-bold text-ink">
                    {trimNum(it.servings)}
                  </span>
                  <Stepper label="+" onClick={() => changeServings(it.id, 0.5)} />
                  <button
                    onClick={() => removeItem(it.id)}
                    aria-label={`Remove ${it.name}`}
                    className="ml-1 text-ink-3 hover:text-red-d"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            onClick={addItem}
            className="mt-3.5 inline-flex items-center gap-1.5 rounded-[10px] border border-line-2 px-3.5 py-2 text-[12.5px] font-bold text-ink"
          >
            <PlusIcon size={14} />
            Add item
          </button>
        </Card>
      </div>

      <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-card bg-card p-4 shadow-card md:flex-row md:items-center">
        <p className="max-w-[460px] text-[12px] font-medium leading-relaxed text-ink-2">
          These are AI estimates shown as ranges. Adjust anything that looks off,
          then confirm to save the midpoint to Today.
        </p>
        <Button size="lg" onClick={handleConfirm} disabled={items.length === 0}>
          Confirm &amp; save
        </Button>
      </div>
    </div>
  );
}

function Stepper({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-[9px] border border-line-2 text-[15px] font-bold text-ink-2"
    >
      {label}
    </button>
  );
}
