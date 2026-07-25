"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getAllEntries } from "@/lib/api";
import { getCurrentUserId, getStoredSession } from "@/lib/auth";
import { getToday } from "@/lib/date";
import { getStoredProfile } from "@/lib/profile";
import { Skeleton } from "@/components/ui";
import type { IntakeEntry, NutritionTargets, Subscription } from "@/lib/types";
import { InsightsLocked } from "@/components/insights/InsightsLocked";
import { InsightsPremium } from "@/components/insights/InsightsPremium";

export default function InsightsPage() {
  const pathname = usePathname();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [entries, setEntries] = useState<IntakeEntry[] | null>(null);
  const [targets, setTargets] = useState<NutritionTargets | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const reload = useCallback(() => {
    const session = getStoredSession();
    setSubscription(session?.subscription ?? "free");
    setUserId(getCurrentUserId());
    setTargets(getStoredProfile().targets);
    // Always re-fetch intakes for this session from the backend.
    getAllEntries().then(setEntries);
  }, []);

  useEffect(() => {
    reload();
  }, [reload, pathname]);

  useEffect(() => {
    const onFocus = () => reload();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  if (subscription === null || userId === null) {
    return <Skeleton className="h-40" />;
  }

  if (subscription !== "premium") {
    return <InsightsLocked />;
  }

  if (!entries || !targets) {
    return <Skeleton className="h-40" />;
  }

  return (
    <InsightsPremium
      entries={entries}
      targets={targets}
      endIso={getToday()}
      userId={userId}
    />
  );
}
