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
import { clearSession, getStoredSession, type Session } from "@/lib/auth";
import { DEFAULT_TARGETS, type NutritionTargets } from "@/lib/types";
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

  useEffect(() => {
    if (open) setSession(getStoredSession());
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

  function handleLogout() {
    clearSession();
    onClose();
    router.replace("/login");
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
            Nutrition targets
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <Field
              label="Calories"
              name="sheet_calories"
              type="number"
              value={targets.calories}
              onChange={(e) =>
                setTargets((t) => ({
                  ...t,
                  calories: Number(e.target.value) || 0,
                }))
              }
            />
            <Field
              label="Sugar (g)"
              name="sheet_sugar"
              type="number"
              value={targets.sugar_g}
              onChange={(e) =>
                setTargets((t) => ({
                  ...t,
                  sugar_g: Number(e.target.value) || 0,
                }))
              }
            />
            <Field
              label="Water"
              name="sheet_water"
              type="number"
              value={targets.water_cups}
              onChange={(e) =>
                setTargets((t) => ({
                  ...t,
                  water_cups: Number(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-ink-3">
            <CheckIcon size={12} className="text-teal" />
            Goal set by you
          </div>
        </div>

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
              href="/scan/medical"
              label="Medical reports"
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
