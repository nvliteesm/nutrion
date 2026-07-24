"use client";

import { useEffect, useState } from "react";
import { getAllEntries } from "@/lib/api";
import { getStoredSession } from "@/lib/auth";
import { mockUser, MOCK_TODAY } from "@/lib/mock-data";
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
    return (
      <div className="h-40 animate-pulse rounded-card-lg bg-black/[0.05]" />
    );
  }

  if (subscription !== "premium") {
    return <InsightsLocked />;
  }

  if (!entries) {
    return (
      <div className="h-40 animate-pulse rounded-card-lg bg-black/[0.05]" />
    );
  }

  return (
    <InsightsPremium
      entries={entries}
      targets={mockUser.targets}
      endIso={MOCK_TODAY}
    />
  );
}
