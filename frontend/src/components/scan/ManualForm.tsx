"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button } from "@/components/ui";
import { Field } from "@/components/auth/Field";
import {
  ChevronLeftIcon,
  CupIcon,
  DropletIcon,
  UtensilsIcon,
  CheckIcon,
} from "@/components/icons";
import { addEntry, addFavorite, getFavorites } from "@/lib/store";
import { getCurrentUserId } from "@/lib/auth";
import { getToday, getNowHHMM } from "@/lib/date";
import { parseNonNegative } from "@/lib/nutrition";
import { useToast } from "@/components/ui";
import type { EntryType, Favorite, IntakeEntry } from "@/lib/types";

const tabs: { type: EntryType; label: string; icon: typeof CupIcon }[] = [
  { type: "food", label: "Food", icon: UtensilsIcon },
  { type: "drink", label: "Drink", icon: CupIcon },
  { type: "water", label: "Water", icon: DropletIcon },
];

function currentHHMM(): string {
  return getNowHHMM();
}

const zeroNutrients = () => ({
  calories: 0,
  carbs_g: 0,
  totalSugar_g: 0,
  addedSugar_g: 0,
  protein_g: 0,
  fat_g: 0,
  caffeine_mg: 0,
});

export function ManualForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [tab, setTab] = useState<EntryType>("food");

  const [name, setName] = useState("");
  const [portion, setPortion] = useState("");
  const [volumeMl, setVolumeMl] = useState(250);
  const [time, setTime] = useState(currentHHMM());
  const [n, setN] = useState(zeroNutrients());
  const [saveFav, setSaveFav] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("type");
    if (t === "food" || t === "drink" || t === "water") setTab(t);
  }, []);

  const num = (key: keyof ReturnType<typeof zeroNutrients>) => ({
    value: n[key],
    min: 0,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setN((prev) => ({ ...prev, [key]: parseNonNegative(e.target.value) })),
  });

  const canSave =
    tab === "water" ? volumeMl > 0 : name.trim().length > 0;

  function applyFavorite(fav: Favorite) {
    setName(fav.name);
    setPortion(fav.portion ?? "");
    if (fav.volumeMl) setVolumeMl(fav.volumeMl);
    setN({ ...zeroNutrients(), ...fav.nutrients });
  }

  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    if (!canSave || submitting) return;
    setSubmitting(true);

    const serving =
      tab === "water"
        ? `1 cup (${volumeMl} ml)`
        : tab === "drink"
          ? `${volumeMl} ml`
          : portion || "1 serving";

    const meal = {
      name: tab === "water" ? "Water" : name.trim(),
      serving,
      nutrients: {
        calories: tab === "water" ? 0 : n.calories,
        protein_g: tab === "water" ? 0 : n.protein_g,
        carbs_g: tab === "water" ? 0 : n.carbs_g,
        fat_g: tab === "water" ? 0 : n.fat_g,
        fiber_g: 0,
        sugar_g: tab === "water" ? 0 : n.totalSugar_g,
        sodium_mg: 0,
      },
      source: "manual",
      confidence: 1.0,
    };

    try {
      const res = await fetch("/memory/intakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: getCurrentUserId(), meal }),
      });

      if (!res.ok) {
        // Fallback to localStorage if backend fails.
        const loggedAt = `${getToday()}T${time}:00`;
        addEntry({
          type: tab,
          name: meal.name,
          loggedAt,
          source: "manual",
          confirmed: true,
          portion: serving,
          volumeMl: tab !== "food" ? volumeMl : undefined,
          nutrients: { ...n, addedSugar_g: 0 },
        });
      }

      if (saveFav && tab !== "water") {
        addFavorite({
          type: tab,
          name: name.trim(),
          portion: serving,
          volumeMl: tab === "drink" ? volumeMl : undefined,
          nutrients: { ...n, addedSugar_g: 0 },
        });
      }

      toast({
        title: "Entry saved",
        description: tab === "water" ? "Water added to Today" : `${meal.name} added to Today`,
        variant: "success",
      });
      router.push("/today");
    } catch {
      // Network error — save locally as fallback.
      const loggedAt = `${getToday()}T${time}:00`;
      addEntry({
        type: tab,
        name: meal.name,
        loggedAt,
        source: "manual",
        confirmed: true,
        portion: serving,
        volumeMl: tab !== "food" ? volumeMl : undefined,
        nutrients: { ...n, addedSugar_g: 0 },
      });
      toast({
        title: "Saved locally",
        description: "Backend unreachable — saved to this device.",
        variant: "info",
      });
      router.push("/today");
    } finally {
      setSubmitting(false);
    }
  }

  const tabFavorites = favorites.filter((f) => f.type === tab);

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/today");
  }

  return (
    <div>
      <button
        type="button"
        onClick={goBack}
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-2 transition-colors hover:text-ink"
      >
        <ChevronLeftIcon size={16} />
        Back
      </button>
      <h1 className="mb-4 text-[22px] font-extrabold tracking-tight text-ink">
        Add manually
      </h1>

      {/* Tabs */}
      <div className="mb-4 inline-flex gap-1.5 rounded-[13px] bg-card p-1.5 shadow-card">
        {tabs.map(({ type, label, icon: Icon }) => (
          <button
            key={type}
            onClick={() => setTab(type)}
            className={`inline-flex items-center gap-1.5 rounded-[9px] px-4 py-2 text-[12.5px] font-bold transition-colors ${
              tab === type ? "bg-navy text-white" : "text-ink-2"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tabFavorites.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {tabFavorites.map((fav) => (
            <button
              key={fav.id}
              onClick={() => applyFavorite(fav)}
              className="rounded-full bg-app-bg px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 hover:bg-line"
            >
              {fav.name}
            </button>
          ))}
        </div>
      )}

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tab !== "water" && (
            <div className="sm:col-span-2">
              <Field
                label={tab === "food" ? "Food name" : "Drink name"}
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tab === "food" ? "e.g. Overnight oats" : "e.g. Iced latte"}
              />
            </div>
          )}

          {tab === "food" && (
            <Field
              label="Portion"
              name="portion"
              value={portion}
              onChange={(e) => setPortion(e.target.value)}
              placeholder="e.g. 1 bowl (240 g)"
            />
          )}

          {(tab === "drink" || tab === "water") && (
            <Field
              label="Volume (ml)"
              name="volume"
              type="number"
              value={volumeMl}
              min={0}
              onChange={(e) => setVolumeMl(parseNonNegative(e.target.value))}
            />
          )}

          <Field
            label="Time consumed"
            name="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />

          {tab !== "water" && (
            <>
              <Field label="Calories (kcal)" name="calories" type="number" {...num("calories")} />
              <Field label="Carbohydrates (g)" name="carbs" type="number" {...num("carbs_g")} />
              <Field label="Total sugar (g)" name="totalSugar" type="number" {...num("totalSugar_g")} />
            </>
          )}

          {tab === "food" && (
            <>
              <Field label="Protein (g)" name="protein" type="number" {...num("protein_g")} />
              <Field label="Fat (g)" name="fat" type="number" {...num("fat_g")} />
            </>
          )}

          {tab === "drink" && (
            <Field label="Caffeine (mg)" name="caffeine" type="number" {...num("caffeine_mg")} />
          )}
        </div>

        {tab !== "water" && (
          <button
            onClick={() => setSaveFav((v) => !v)}
            className="mt-4 flex items-center gap-2.5 text-[12.5px] font-semibold text-ink-2"
          >
            <span
              className={`inline-flex h-[18px] w-[18px] items-center justify-center rounded-md ${
                saveFav ? "bg-teal text-white" : "border border-line-2"
              }`}
            >
              {saveFav && <CheckIcon size={11} />}
            </span>
            Save to favorites for faster logging next time
          </button>
        )}

        <div className="mt-5 flex gap-2.5">
          <Button variant="outline" onClick={goBack}>
            Cancel
          </Button>
          <Button fullWidth onClick={handleSave} disabled={!canSave || submitting}>
            {submitting ? "Saving…" : "Save entry"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
