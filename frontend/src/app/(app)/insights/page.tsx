"use client";

import { useEffect, useState } from "react";
import { getAllEntries } from "@/lib/api";
import { getStoredSession } from "@/lib/auth";
import { getToday } from "@/lib/date";
import { DEFAULT_TARGETS } from "@/lib/types";
import { Skeleton } from "@/components/ui";
import type { IntakeEntry, Subscription } from "@/lib/types";
import { InsightsLocked } from "@/components/insights/InsightsLocked";
import { InsightsPremium } from "@/components/insights/InsightsPremium";

export default function InsightsPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [entries, setEntries] = useState<IntakeEntry[] | null>(null);

  useEffect(() => {
    setSubscription(getStoredSession()?.subscription ?? "free");
    getAllEntries().then(setEntries);
  }, []);

  if (subscription === null) {
    return <Skeleton className="h-40" />;
  }

  if (subscription !== "premium") {
    return <InsightsLocked />;
  }

  if (!entries) {
    return <Skeleton className="h-40" />;
  }

  return (
    <InsightsPremium
      entries={entries}
      targets={DEFAULT_TARGETS}
      endIso={getToday()}
    />
  );
}
