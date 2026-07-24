"use client";

import { useEffect, useState } from "react";
import {
  getCurrentUser,
  getTodayEntries,
  getTodayTotals,
} from "@/lib/api";
import { dailyInsight } from "@/lib/insight";
import type { DailyTotals, IntakeEntry, UserProfile } from "@/lib/types";
import { DashboardHeader } from "@/components/today/DashboardHeader";
import { CalorieHero } from "@/components/today/CalorieHero";
import { SugarCard } from "@/components/today/SugarCard";
import { HydrationCard } from "@/components/today/HydrationCard";
import { QuickActions } from "@/components/today/QuickActions";
import { RecentEntries } from "@/components/today/RecentEntries";
import { InsightCard } from "@/components/today/InsightCard";
import { DashboardSkeleton } from "@/components/today/DashboardSkeleton";
import { EmptyDashboard } from "@/components/today/EmptyDashboard";

interface DashboardData {
  user: UserProfile;
  totals: DailyTotals;
  entries: IntakeEntry[];
}

export default function TodayPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getCurrentUser(), getTodayTotals(), getTodayEntries()]).then(
      ([user, totals, entries]) => {
        if (active) setData({ user, totals, entries });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  if (!data) return <DashboardSkeleton />;

  const { user, totals, entries } = data;

  if (entries.length === 0) {
    return <EmptyDashboard fullName={user.fullName} />;
  }

  return (
    <div className="flex animate-fade-up flex-col gap-4 md:gap-[18px]">
      <DashboardHeader
        fullName={user.fullName}
        dateIso={totals.date}
        streakDays={user.streakDays}
      />

      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr] md:gap-[18px]">
        <CalorieHero
          totals={totals}
          targets={user.targets}
          goalSource={user.goalSource}
        />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-1 md:gap-[18px]">
          <SugarCard
            addedSugar={totals.addedSugar_g}
            target={user.targets.addedSugar_g}
          />
          <HydrationCard
            cups={totals.water_cups}
            target={user.targets.water_cups}
          />
        </div>
      </div>

      <QuickActions />

      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr] md:gap-[18px]">
        <RecentEntries entries={entries} />
        <InsightCard
          insight={dailyInsight(totals, user.targets)}
          confirmedCount={totals.confirmedCount}
        />
      </div>
    </div>
  );
}
