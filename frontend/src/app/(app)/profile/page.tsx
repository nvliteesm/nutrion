"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card } from "@/components/ui";
import { Field } from "@/components/auth/Field";
import {
  CheckIcon,
  ChartIcon,
  ChevronRightIcon,
  FileTextIcon,
  SparkleIcon,
} from "@/components/icons";
import { clearSession, getStoredSession, type Session } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { DEFAULT_TARGETS } from "@/lib/types";
import type { NutritionTargets } from "@/lib/types";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function ProfilePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [targets, setTargets] = useState<NutritionTargets>(DEFAULT_TARGETS);

  useEffect(() => {
    setSession(getStoredSession());
  }, []);

  if (!session) return null;

  const isPremium = session.subscription === "premium";

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="mx-auto max-w-[560px]">
      <h1 className="mb-5 text-[22px] font-extrabold tracking-tight text-ink md:text-[24px]">
        Profile
      </h1>

      {/* Account card */}
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

      {/* Upgrade CTA for free users */}
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

      {/* Nutrition targets */}
      <Card className="mb-4 p-5">
        <div className="mb-3.5 text-[14px] font-bold text-ink">Nutrition targets</div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field
            label="Calories (kcal)"
            name="t_calories"
            type="number"
            value={targets.calories}
            onChange={(e) =>
              setTargets((t) => ({ ...t, calories: Number(e.target.value) || 0 }))
            }
          />
          <Field
            label="Added sugar (g)"
            name="t_sugar"
            type="number"
            value={targets.addedSugar_g}
            onChange={(e) =>
              setTargets((t) => ({ ...t, addedSugar_g: Number(e.target.value) || 0 }))
            }
          />
          <Field
            label="Water (cups)"
            name="t_water"
            type="number"
            value={targets.water_cups}
            onChange={(e) =>
              setTargets((t) => ({ ...t, water_cups: Number(e.target.value) || 0 }))
            }
          />
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[11.5px] font-medium text-ink-3">
          <CheckIcon size={12} className="text-teal" />
          Goal set by you
        </div>
      </Card>

      {/* Quick links */}
      <Card className="mb-4 divide-y divide-line">
        {isPremium && (
          <ProfileLink href="/report" label="Personal nutrition report" icon={<FileTextIcon size={18} />} />
        )}
        {isPremium && (
          <ProfileLink href="/scan/medical" label="Medical reports" icon={<FileTextIcon size={18} />} />
        )}
        <ProfileLink href="/assistant" label="AI nutrition assistant" icon={<SparkleIcon size={18} />} />
        <ProfileLink href="/admin" label="Admin portal" icon={<ChartIcon size={18} />} />
      </Card>

      {/* Appearance */}
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

      {/* Danger zone */}
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
