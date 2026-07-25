"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getStoredSession, type Session } from "@/lib/auth";
import { localDayKey } from "@/lib/date";
import { FlameIcon, PlusIcon } from "@/components/icons";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationPanel";

async function fetchStreak(): Promise<number> {
  try {
    const res = await fetch("/intakes?limit=300");
    if (!res.ok) return 0;
    const rows = (await res.json()) as { logged_at: string }[];
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    const days = new Set(rows.map((r) => localDayKey(r.logged_at)));
    let streak = 0;
    const d = new Date();
    while (true) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (days.has(key)) {
        streak += 1;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  } catch {
    return 0;
  }
}

/** Slim desktop top bar (primary nav lives in the left rail). */
export function TopNav() {
  const [session, setSession] = useState<Session | null>(null);
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    setSession(getStoredSession());
    fetchStreak().then(setStreakDays);
  }, []);

  const initials = session?.initials ?? "U";

  return (
    <header className="sticky top-0 z-30 flex h-[58px] items-center justify-between border-b border-line bg-card/90 px-4 backdrop-blur md:hidden">
      <Link href="/today" aria-label="NutriON home">
        <Logo />
      </Link>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-[10px] bg-app-bg px-2.5 py-1.5 text-[11px] font-bold text-amber-d">
          <FlameIcon size={13} />
          {streakDays}d
        </span>
        <Link
          href="/scan"
          className="inline-flex items-center gap-1 rounded-[10px] bg-teal px-2.5 py-1.5 text-[11px] font-bold text-navy-ink"
        >
          <PlusIcon size={13} />
          Log
        </Link>
        <NotificationBell />
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal/20 text-[11px] font-bold text-teal-d">
          {initials}
        </span>
      </div>
    </header>
  );
}
