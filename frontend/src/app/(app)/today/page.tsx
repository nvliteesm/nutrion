"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAllEntries,
  getCurrentUser,
  getTodayEntries,
  getTodayTotals,
} from "@/lib/api";
import { getToday } from "@/lib/date";
import { firstName, formatDateLong, greeting } from "@/lib/format";
import { buildMonthGrid, groupByDate } from "@/lib/history";
import { waterMl } from "@/lib/nutrition";
import type { DailyTotals, IntakeEntry, UserProfile } from "@/lib/types";
import { FlameIcon, PlusIcon } from "@/components/icons";
import { DashboardSkeleton } from "@/components/today/DashboardSkeleton";
import { SugarCard } from "@/components/today/SugarCard";
import { HydrationCard } from "@/components/today/HydrationCard";
import { QuickActions } from "@/components/today/QuickActions";
import { MonthCalendar } from "@/components/history/MonthCalendar";
import { DayDetail } from "@/components/history/DayDetail";
import { EntryDetailModal } from "@/components/history/EntryDetailModal";
import { LogEntrySheet } from "@/components/layout/LogEntrySheet";

interface DashboardData {
  user: UserProfile;
  totals: DailyTotals;
  todayEntries: IntakeEntry[];
  allEntries: IntakeEntry[];
}

export default function TodayPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<IntakeEntry | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const todayIso = getToday();
  const [ty, tm] = [
    Number(todayIso.slice(0, 4)),
    Number(todayIso.slice(5, 7)) - 1,
  ];
  const [cursor, setCursor] = useState({ year: ty, month0: tm });
  const [selectedIso, setSelectedIso] = useState(todayIso);

  const refresh = useCallback(() => {
    Promise.all([
      getCurrentUser(),
      getTodayTotals(),
      getTodayEntries(),
      getAllEntries(),
    ]).then(([user, totals, todayEntries, allEntries]) => {
      setData({ user, totals, todayEntries, allEntries });
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const byDate = useMemo(
    () => groupByDate(data?.allEntries ?? []),
    [data?.allEntries],
  );

  const grid = useMemo(
    () =>
      data
        ? buildMonthGrid(
            cursor.year,
            cursor.month0,
            byDate,
            data.user.targets,
            todayIso,
          )
        : [],
    [cursor, byDate, data, todayIso],
  );

  const monthLabel = new Date(cursor.year, cursor.month0, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );

  const selectedEntries = byDate.get(selectedIso) ?? [];

  if (!data) return <DashboardSkeleton />;

  const { user, totals, todayEntries } = data;
  const ml = waterMl(todayEntries);

  function stepMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month0 + delta, 1);
      return { year: d.getFullYear(), month0: d.getMonth() };
    });
  }

  return (
<<<<<<< Updated upstream
    <div className="flex flex-col gap-4 md:gap-5">
=======
    <div className="flex animate-fade-up flex-col gap-3 md:gap-4">
>>>>>>> Stashed changes
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink md:text-[26px]">
            {greeting()}, {firstName(user.fullName)}
          </h1>
          <p className="mt-1 text-[13px] font-medium text-ink-3">
            {formatDateLong(totals.date)}
            {todayEntries.filter((e) => e.type !== "water").length === 0
              ? " · Nothing logged yet today"
              : ` · ${todayEntries.filter((e) => e.type !== "water").length} entries today`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-[11px] bg-card px-3 py-2 text-[12px] font-bold text-amber-d shadow-card">
            <FlameIcon size={14} />
            {user.streakDays}-day streak
          </span>
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              setLogOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-[11px] bg-teal px-3.5 py-2 text-[12.5px] font-bold text-navy-ink transition hover:bg-teal-d"
          >
            <PlusIcon size={14} />
            Log entry
          </button>
        </div>
      </header>

<<<<<<< Updated upstream
      <div className="grid items-stretch gap-4 md:grid-cols-2 md:gap-5">
        <SugarCard
          sugar={totals.totalSugar_g}
          target={user.targets.sugar_g}
          delay={0.05}
        />
=======
      <div className="grid items-stretch gap-3 md:grid-cols-2 md:gap-4">
        <SugarCard sugar={totals.totalSugar_g} target={user.targets.sugar_g} />
>>>>>>> Stashed changes
        <HydrationCard
          ml={ml}
          targetCups={user.targets.water_cups}
          onChanged={refresh}
          delay={0.1}
        />
      </div>

      <QuickActions delay={0.15} />

<<<<<<< Updated upstream
      <div className="grid items-start gap-4 md:grid-cols-2 md:gap-5">
        <MonthCalendar
          monthLabel={monthLabel}
          cells={grid}
          selectedIso={selectedIso}
          todayIso={todayIso}
          onSelect={setSelectedIso}
          onPrev={() => stepMonth(-1)}
          onNext={() => stepMonth(1)}
          delay={0.28}
        />
        <DayDetail
          dateIso={selectedIso}
          entries={selectedEntries}
          targets={user.targets}
          onSelectEntry={setSelectedEntry}
          delay={0.33}
        />
=======
      <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-4">
        <div className="min-w-0">
          <MonthCalendar
            monthLabel={monthLabel}
            cells={grid}
            selectedIso={selectedIso}
            todayIso={todayIso}
            onSelect={setSelectedIso}
            onPrev={() => stepMonth(-1)}
            onNext={() => stepMonth(1)}
          />
        </div>
        <div className="min-w-0 md:h-full">
          <DayDetail
            dateIso={selectedIso}
            entries={selectedEntries}
            targets={user.targets}
            onSelectEntry={setSelectedEntry}
          />
        </div>
>>>>>>> Stashed changes
      </div>

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      <LogEntrySheet open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}
