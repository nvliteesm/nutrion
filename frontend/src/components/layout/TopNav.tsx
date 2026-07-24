"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { navItems } from "@/lib/nav";
import { getStoredSession, type Session } from "@/lib/auth";
import { localDayKey } from "@/lib/date";
import { FlameIcon, PlusIcon } from "@/components/icons";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationPanel";

/** Compute streak: consecutive days from today backwards with at least 1 intake. */
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

/** Desktop horizontal navbar (hidden on mobile — the bottom bar takes over). */
export function TopNav() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    setSession(getStoredSession());
    fetchStreak().then(setStreakDays);
  }, []);

  const initials = session?.initials ?? "U";

  return (
    <header className="sticky top-0 z-30 hidden h-[62px] items-center justify-between bg-navy px-6 text-white md:flex">
      <div className="flex items-center gap-8">
        <Link href="/today" aria-label="NutriON home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 text-[13.5px] transition-colors",
                  active
                    ? "bg-white/[0.12] font-semibold text-white"
                    : "font-medium text-white/70 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                <Icon size={17} />
                {item.label}
                {item.pro && (
                  <span className="rounded-[5px] bg-amber px-1.5 py-0.5 text-[8.5px] font-bold tracking-wider text-navy-ink">
                    PRO
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-[10px] bg-white/10 px-3 py-2 text-[12.5px] font-bold text-amber">
          <FlameIcon size={14} />
          {streakDays}-day streak
        </span>
        <Link
          href="/scan"
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-teal px-3.5 py-2 text-[12.5px] font-bold text-navy-ink transition-colors hover:bg-teal-d"
        >
          <PlusIcon size={14} />
          Log entry
        </Link>
        <NotificationBell />
        <span className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-white/[0.14] text-[13px] font-bold text-white">
          {initials}
        </span>
      </div>
    </header>
  );
}
