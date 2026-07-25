"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, useToast } from "@/components/ui";
import { Field } from "@/components/auth/Field";
import {
  CheckIcon,
  ChartIcon,
  ChevronRightIcon,
  FileTextIcon,
  SparkleIcon,
} from "@/components/icons";
import { getStoredSession, logout, type Session } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { calculateSugarBarrier, listMedicalReports } from "@/lib/api";
import { apiFetch } from "@/lib/apiFetch";
import {
  applyIntakeTargets,
  getStoredProfile,
  hasPersonalBasics,
  savePersonalData,
  saveTargets,
  type PersonalData,
} from "@/lib/profile";
import { DEFAULT_TARGETS, type NutritionTargets, type Sex } from "@/lib/types";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function ProfilePage() {
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
    setSession(getStoredSession());
    const stored = getStoredProfile();
    setTargets(stored.targets);
    setPersonal(stored.personal);
    setGoalSource(stored.goalSource);
    setBarrierNote(stored.sugarBarrierNote);
  }, []);

  if (!session) return null;

  const isPremium = session.subscription === "premium";

  async function handleLogout() {
    await logout();
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
      setBarrierMsg(
        err instanceof Error ? err.message : "Could not calculate barrier.",
      );
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
    <div className="mx-auto max-w-[560px]">
      <h1 className="mb-5 text-[22px] font-extrabold tracking-tight text-ink md:text-[24px]">
        Profile
      </h1>

      <Card className="mb-4 p-5">
        <div className="flex items-center gap-3.5">
          <span className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-[14px] bg-navy text-[17px] font-bold text-white">
            {session.initials}
          </span>
          <div className="flex-1">
            <div className="text-[16px] font-extrabold text-ink">
              {session.fullName}
            </div>
            <div className="text-[12.5px] font-medium text-ink-2">
              {session.email}
            </div>
          </div>
          <Badge tone={isPremium ? "amber" : "neutral"}>
            {isPremium ? "Premium" : "Free"}
          </Badge>
        </div>
      </Card>

      {!isPremium && (
        <Link href="/premium">
          <Card className="mb-4 flex items-center gap-3 bg-gradient-to-r from-navy to-navy-2 p-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] bg-amber text-navy-ink">
              <SparkleIcon size={18} />
            </span>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-white">Go Premium</div>
              <div className="text-[11.5px] font-medium text-white/60">
                AI insights, medical reports &amp; 90-day trends
              </div>
            </div>
            <ChevronRightIcon size={18} className="text-white/40" />
          </Card>
        </Link>
      )}

      <Card className="mb-4 p-5">
        <div className="mb-3.5 text-[14px] font-bold text-ink">Personal data</div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field
            label="Age"
            name="t_age"
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
            <label htmlFor="t_sex" className="text-xs font-semibold text-ink-2">
              Sex
            </label>
            <select
              id="t_sex"
              name="t_sex"
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
            name="t_height"
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
      </Card>

      <Card className="mb-4 p-5">
        <div className="mb-3.5 text-[14px] font-bold text-ink">
          Nutrition targets
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field
            label="Calories (kcal)"
            name="t_calories"
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
            label="Total sugar (g)"
            name="t_sugar"
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
            name="t_water"
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
        <p className="mt-1.5 text-[11px] font-medium text-ink-3">1 cup = 250 ml</p>
        <div className="mt-3 flex items-center gap-1.5 text-[11.5px] font-medium text-ink-3">
          <CheckIcon size={12} className="text-teal" />
          {goalSource === "nutrion"
            ? "Calories, sugar & water set from medical + profile"
            : "Goal set by you"}
        </div>
        {barrierNote && (
          <p className="mt-2 text-[12px] font-medium leading-snug text-ink-3">
            {barrierNote}
          </p>
        )}
        <Button
          variant="outline"
          className="mt-3 w-full"
          disabled={barrierBusy}
          onClick={onCalculateBarrier}
        >
          {barrierBusy
            ? "Calculating…"
            : "Auto-calculate calorie, sugar & water"}
        </Button>
        {barrierMsg && (
          <p className="mt-2 text-[12px] font-medium leading-snug text-ink-2">
            {barrierMsg}
          </p>
        )}
        <Button className="mt-3 w-full" onClick={onSaveAll}>
          {savedFlash ? "Saved" : "Save profile"}
        </Button>
      </Card>

      <Card className="mb-4 divide-y divide-line">
        {isPremium && (
          <ProfileLink
            href="/report"
            label="Personal nutrition report"
            icon={<FileTextIcon size={18} />}
          />
        )}
        {isPremium && (
          <ProfileLink
            href="/medical"
            label="Medical records"
            icon={<FileTextIcon size={18} />}
          />
        )}
        <ProfileLink href="/history" label="AI Chat" icon={<SparkleIcon size={18} />} />
        <ProfileLink href="/admin" label="Admin portal" icon={<ChartIcon size={18} />} />
      </Card>

      <Card className="mb-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-ink">Appearance</div>
            <div className="text-[12px] font-medium text-ink-3">
              Switch between light and dark
            </div>
          </div>
          <ThemeToggle />
        </div>
      </Card>

      {/* Telegram */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-ink">Telegram</div>
            <div className="text-[12px] font-medium text-ink-3">
              Receive daily nutrition summaries
            </div>
          </div>
          <TelegramButton />
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-bold text-ink">Account</div>
            <div className="text-[12px] font-medium text-ink-3">
              Log out or delete your account
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </Card>
    </div>
  );
}

function TelegramButton() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  async function sendSummary() {
    setSending(true);
    try {
      const userId = getStoredSession()?.userId ?? "default";
      const res = await apiFetch("/api/telegram/send-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: "1176087052", user_id: userId }),
      });
      if (res.ok) {
        setSent(true);
        toast({ title: "Sent!", description: "Daily summary sent to Telegram", variant: "success" });
      } else {
        toast({ title: "Failed", description: "Couldn't send. Try again.", variant: "error" });
      }
    } catch {
      toast({ title: "Offline", description: "Backend unreachable", variant: "error" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Button variant="outline" onClick={sendSummary} disabled={sending || sent}>
      {sent ? "Sent ✓" : sending ? "Sending…" : "Send summary"}
    </Button>
  );
}

function ProfileLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-app-bg"
    >
      <span className="text-ink-2">{icon}</span>
      <span className="flex-1 text-[13.5px] font-semibold text-ink">{label}</span>
      <ChevronRightIcon size={16} className="text-ink-3" />
    </Link>
  );
}
