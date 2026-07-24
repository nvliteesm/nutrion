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

/** Fetch the proactive AI daily insight from the backend. */
async function fetchAIInsight(): Promise<string | null> {
  try {
    const res = await fetch("/api/ai/insights/daily?user_id=default", {
      method: "POST",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.body || null;
  } catch {
    return null;
  }
}

export default function TodayPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([getCurrentUser(), getTodayTotals(), getTodayEntries()]).then(
      ([user, totals, entries]) => {
        if (active) setData({ user, totals, entries });
      },
    );
    // Fetch the real AI insight in parallel (non-blocking).
    fetchAIInsight().then((text) => {
      if (active) setAiInsight(text);
    });
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
            sugar={totals.totalSugar_g}
            target={user.targets.sugar_g}
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
          insight={aiInsight ?? dailyInsight(totals, user.targets)}
          confirmedCount={totals.confirmedCount}
        />
      </div>
    </div>
  );
}
