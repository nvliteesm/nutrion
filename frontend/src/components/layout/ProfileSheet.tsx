"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import { Field } from "@/components/auth/Field";
import {
  ChartIcon,
  CheckIcon,
  ChevronRightIcon,
  FileTextIcon,
  SparkleIcon,
} from "@/components/icons";
import { getStoredSession, logout, type Session } from "@/lib/auth";
import { calculateSugarBarrier, listMedicalReports } from "@/lib/api";
import {
  applyIntakeTargets,
  getStoredProfile,
  hasPersonalBasics,
  savePersonalData,
  saveTargets,
  type PersonalData,
} from "@/lib/profile";
import {
  DEFAULT_TARGETS,
  type NutritionTargets,
  type Sex,
} from "@/lib/types";
import { ThemeToggle } from "./ThemeToggle";
import { Sheet } from "./Sheet";

export function ProfileSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [targets, setTargets] = useState<NutritionTargets>(DEFAULT_TARGETS);
  const [personal, setPersonal] = useState<PersonalData>({
    age: null,
    sex: null,
    height_cm: null,
  });
  const [goalSource, setGoalSource] = useState<"user" | "nutrion">("user");
  const [barrierNote, setBarrierNote] = useState<string | undefined>();
  const [barrierBusy, setBarrierBusy] = useState(false);
  const [barrierMsg, setBarrierMsg] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSession(getStoredSession());
    const stored = getStoredProfile();
    setTargets(stored.targets);
    setPersonal(stored.personal);
    setGoalSource(stored.goalSource);
    setBarrierNote(stored.sugarBarrierNote);
    setBarrierMsg(null);
  }, [open]);

  if (!session) {
    return (
      <Sheet open={open} onClose={onClose}>
        <div className="px-5 py-10 text-center text-[13px] font-medium text-ink-3">
          Sign in to view your profile.
        </div>
      </Sheet>
    );
  }

  const isPremium = session.subscription === "premium";

  async function handleLogout() {
    await logout();
    onClose();
    router.replace("/login");
  }

  function persistPersonal(next: PersonalData) {
    setPersonal(next);
    savePersonalData(next);
  }

  function persistTargets(next: NutritionTargets) {
    setTargets(next);
    setGoalSource("user");
    saveTargets(next, "user");
    setBarrierNote(undefined);
  }

  async function onCalculateBarrier() {
    setBarrierBusy(true);
    setBarrierMsg(null);
    try {
      if (!hasPersonalBasics(personal)) {
        setBarrierMsg("Add age, sex, and height first.");
        return;
      }
      const reports = await listMedicalReports();
      const latest = reports[0];
      const result = await calculateSugarBarrier({
        age: personal.age,
        sex: personal.sex,
        height_cm: personal.height_cm,
        hba1c: latest?.hba1c ?? null,
        fasting_glucose: latest?.fasting_glucose ?? null,
      });
      const stored = applyIntakeTargets(
        {
          calories: result.calories ?? targets.calories,
          sugar_g: result.sugar_limit_g,
          water_cups: result.water_cups ?? targets.water_cups,
        },
        result.rationale,
      );
      setTargets(stored.targets);
      setGoalSource(stored.goalSource);
      setBarrierNote(stored.sugarBarrierNote);
      const labNote =
        latest?.hba1c != null || latest?.fasting_glucose != null
          ? "using your latest medical report"
          : "from profile (upload a medical report for a tighter sugar target)";
      setBarrierMsg(
        `Set to ${result.calories ?? stored.targets.calories} kcal, ${result.sugar_limit_g} g sugar, and ${result.water_cups ?? stored.targets.water_cups} cups water / day ${labNote}.`,
      );
    } catch (err) {
      setBarrierMsg(err instanceof Error ? err.message : "Could not calculate barrier.");
    } finally {
      setBarrierBusy(false);
    }
  }

  function onSaveAll() {
    savePersonalData(personal);
    saveTargets(targets, goalSource === "nutrion" ? "nutrion" : "user");
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1800);
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="px-5 pb-2 pt-3">
        <h2 className="text-[20px] font-extrabold tracking-tight text-ink">
          Profile
        </h2>
        <p className="mt-1 text-[13px] font-medium text-ink-3">
          Account, goals, and preferences
        </p>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-6 pt-2">
        <div className="flex items-center gap-3 rounded-[16px] border border-line px-3.5 py-3.5">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-navy text-[14px] font-bold text-white">
            {session.initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-bold text-ink">
              {session.fullName}
            </div>
            <div className="truncate text-[12px] font-medium text-ink-3">
              {session.email}
            </div>
          </div>
          <Badge tone={isPremium ? "amber" : "neutral"}>
            {isPremium ? "Premium" : "Free"}
          </Badge>
        </div>

        {!isPremium && (
          <Link
            href="/premium"
            onClick={onClose}
            className="flex items-center gap-3 rounded-[16px] bg-gradient-to-r from-navy to-navy-2 px-3.5 py-3.5"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-amber text-navy-ink">
              <SparkleIcon size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-white">
                Go Premium
              </span>
              <span className="mt-0.5 block text-[12px] font-medium text-white/65">
                AI insights, medical reports &amp; trends
              </span>
            </span>
            <ChevronRightIcon size={18} className="shrink-0 text-white/40" />
          </Link>
        )}

        <div className="rounded-[16px] border border-line px-3.5 py-3.5">
          <div className="mb-3 text-[13px] font-bold text-ink">
            Personal data
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Field
              label="Age"
              name="sheet_age"
              type="number"
              min={1}
              max={120}
              placeholder="—"
              value={personal.age ?? ""}
              onChange={(e) =>
                persistPersonal({
                  ...personal,
                  age: e.target.value === "" ? null : Number(e.target.value) || null,
                })
              }
            />
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="sheet_sex"
                className="text-xs font-semibold text-ink-2"
              >
                Sex
              </label>
              <select
                id="sheet_sex"
                name="sheet_sex"
                value={personal.sex ?? ""}
                onChange={(e) =>
                  persistPersonal({
                    ...personal,
                    sex: (e.target.value || null) as Sex | null,
                  })
                }
                className="h-11 w-full rounded-[12px] border border-line bg-card px-3 text-[13px] font-semibold text-ink outline-none focus:border-teal"
              >
                <option value="">—</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <Field
              label="Height (cm)"
              name="sheet_height"
              type="number"
              min={50}
              max={250}
              placeholder="—"
              value={personal.height_cm ?? ""}
              onChange={(e) =>
                persistPersonal({
                  ...personal,
                  height_cm:
                    e.target.value === "" ? null : Number(e.target.value) || null,
                })
              }
            />
          </div>
        </div>

        <div className="rounded-[16px] border border-line px-3.5 py-3.5">
          <div className="mb-3 text-[13px] font-bold text-ink">
            Nutrition targets
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Field
              label="Calories"
              name="sheet_calories"
              type="number"
              value={targets.calories}
              onChange={(e) =>
                persistTargets({
                  ...targets,
                  calories: Number(e.target.value) || 0,
                })
              }
            />
            <Field
              label="Sugar (g)"
              name="sheet_sugar"
              type="number"
              value={targets.sugar_g}
              onChange={(e) =>
                persistTargets({
                  ...targets,
                  sugar_g: Number(e.target.value) || 0,
                })
              }
            />
            <Field
              label="Water (cups)"
              name="sheet_water"
              type="number"
              value={targets.water_cups}
              onChange={(e) =>
                persistTargets({
                  ...targets,
                  water_cups: Number(e.target.value) || 0,
                })
              }
            />
          </div>
          <p className="mt-1.5 text-[10.5px] font-medium text-ink-3">
            1 cup = 250 ml
          </p>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-3">
            <CheckIcon size={12} className="text-teal" />
            {goalSource === "nutrion"
              ? "Calories, sugar & water set from medical + profile"
              : "Goal set by you"}
          </div>
          {barrierNote && (
            <p className="mt-2 text-[11px] font-medium leading-snug text-ink-3">
              {barrierNote}
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            disabled={barrierBusy}
            onClick={onCalculateBarrier}
          >
            {barrierBusy
              ? "Calculating…"
              : "Auto-calculate calorie, sugar & water"}
          </Button>
          {barrierMsg && (
            <p className="mt-2 text-[11px] font-medium leading-snug text-ink-2">
              {barrierMsg}
            </p>
          )}
        </div>

        <Button size="sm" onClick={onSaveAll} className="w-full">
          {savedFlash ? "Saved" : "Save profile"}
        </Button>

        <div className="overflow-hidden rounded-[16px] border border-line">
          {isPremium && (
            <SheetLink
              href="/report"
              label="Personal nutrition report"
              icon={<FileTextIcon size={18} />}
              onNavigate={onClose}
            />
          )}
          {isPremium && (
            <SheetLink
              href="/medical"
              label="Medical records"
              icon={<FileTextIcon size={18} />}
              onNavigate={onClose}
            />
          )}
          <SheetLink
            href="/history"
            label="AI Chat"
            icon={<SparkleIcon size={18} />}
            onNavigate={onClose}
          />
          <SheetLink
            href="/admin"
            label="Admin portal"
            icon={<ChartIcon size={18} />}
            onNavigate={onClose}
            last
          />
        </div>

        <div className="flex items-center justify-between rounded-[16px] border border-line px-3.5 py-3.5">
          <div>
            <div className="text-[13px] font-bold text-ink">Appearance</div>
            <div className="text-[11.5px] font-medium text-ink-3">
              Light or dark theme
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex items-center justify-between rounded-[16px] border border-line px-3.5 py-3.5">
          <div>
            <div className="text-[13px] font-bold text-ink">Account</div>
            <div className="text-[11.5px] font-medium text-ink-3">
              Sign out of NutriON
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function SheetLink({
  href,
  label,
  icon,
  onNavigate,
  last = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  onNavigate: () => void;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 px-3.5 py-3.5 transition hover:bg-app-bg ${
        last ? "" : "border-b border-line"
      }`}
    >
      <span className="text-ink-2">{icon}</span>
      <span className="flex-1 text-[13.5px] font-semibold text-ink">{label}</span>
      <ChevronRightIcon size={16} className="text-ink-3" />
    </Link>
  );
}
