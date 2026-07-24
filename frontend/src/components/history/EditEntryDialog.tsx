"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Field } from "@/components/auth/Field";
import { XIcon } from "@/components/icons";
import type { IntakeEntry } from "@/lib/types";

/** Compact editor for a single entry's core fields. */
export function EditEntryDialog({
  entry,
  onClose,
  onSave,
}: {
  entry: IntakeEntry;
  onClose: () => void;
  onSave: (id: string, patch: Partial<IntakeEntry>) => void;
}) {
  const [name, setName] = useState(entry.name);
  const [n, setN] = useState({ ...entry.nutrients });

  const num = (key: keyof typeof n) => ({
    value: n[key] ?? 0,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setN((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 })),
  });

  function handleSave() {
    onSave(entry.id, { name: name.trim() || entry.name, nutrients: { ...n } });
    onClose();
  }

  const isWater = entry.type === "water";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-ink/40 p-0 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-t-card-lg bg-card p-5 md:rounded-card-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold text-ink">Edit entry</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-3">
            <XIcon size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {!isWater && (
            <div className="col-span-2">
              <Field
                label="Name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}
          {!isWater && (
            <>
              <Field label="Calories (kcal)" name="calories" type="number" {...num("calories")} />
              <Field label="Carbohydrates (g)" name="carbs" type="number" {...num("carbs_g")} />
              <Field label="Total sugar (g)" name="totalSugar" type="number" {...num("totalSugar_g")} />
              <Field label="Added sugar (g)" name="addedSugar" type="number" {...num("addedSugar_g")} />
            </>
          )}
          {entry.type === "food" && (
            <>
              <Field label="Protein (g)" name="protein" type="number" {...num("protein_g")} />
              <Field label="Fat (g)" name="fat" type="number" {...num("fat_g")} />
            </>
          )}
          {entry.type === "drink" && (
            <Field label="Caffeine (mg)" name="caffeine" type="number" {...num("caffeine_mg")} />
          )}
          {isWater && (
            <p className="col-span-2 text-[13px] font-medium text-ink-2">
              Water entries only track volume — edit or remove it below.
            </p>
          )}
        </div>

        <div className="mt-5 flex gap-2.5">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button fullWidth onClick={handleSave}>
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
