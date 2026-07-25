"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAllEntries,
  getCurrentUser,
  listMedicalReports,
} from "@/lib/api";
import { getStoredProfile } from "@/lib/profile";
import { getToday, localDayKey } from "@/lib/date";
import { firstName, formatDateLong, greeting } from "@/lib/format";
import { buildMonthGrid, groupByDate } from "@/lib/history";
import { buildDailyTotals, waterMl } from "@/lib/nutrition";
import type {
  DailyTotals,
  IntakeEntry,
  MedicalReportSummary,
  UserProfile,
} from "@/lib/types";
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
  reports: MedicalReportSummary[];
}

function reportDateKey(report: MedicalReportSummary): string {
  if (report.test_date) return report.test_date.slice(0, 10);
  return localDayKey(report.created_at);
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
    // One intakes fetch — derive today totals/entries locally (was 3× /intakes).
    Promise.all([getCurrentUser(), getAllEntries({ force: true }), listMedicalReports()]).then(
      ([user, allEntries, reports]) => {
        const today = getToday();
        const todayEntries = allEntries.filter(
          (e) => localDayKey(e.loggedAt) === today,
        );
        const totals = buildDailyTotals(
          today,
          todayEntries,
          getStoredProfile().targets,
        );
        setData({ user, totals, todayEntries, allEntries, reports });
      },
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const byDate = useMemo(
    () => groupByDate(data?.allEntries ?? []),
    [data?.allEntries],
  );

  const reportsByDate = useMemo(() => {
    const map = new Map<string, MedicalReportSummary[]>();
    for (const report of data?.reports ?? []) {
      const key = reportDateKey(report);
      const list = map.get(key) ?? [];
      list.push(report);
      map.set(key, list);
    }
    return map;
  }, [data?.reports]);

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
  const selectedReports = reportsByDate.get(selectedIso) ?? [];

  if (!data) return <DashboardSkeleton />;

  const { user, totals, todayEntries } = data;
  const ml = waterMl(todayEntries);

  // Compute real streak from all entries grouped by day.
  let computedStreak = 0;
  {
    const d = new Date();
    while (true) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (byDate.has(key)) {
        computedStreak += 1;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
  }

  function stepMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month0 + delta, 1);
      return { year: d.getFullYear(), month0: d.getMonth() };
    });
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
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
            {computedStreak}-day streak
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

      <div className="grid items-stretch gap-4 md:grid-cols-2 md:gap-5">
        <SugarCard
          sugar={totals.totalSugar_g}
          target={user.targets.sugar_g}
          delay={0.05}
        />
        <HydrationCard
          ml={ml}
          targetCups={user.targets.water_cups}
          waterEntries={todayEntries.filter((e) => e.type === "water")}
          onChanged={refresh}
          delay={0.1}
        />
      </div>

      <QuickActions delay={0.15} />

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
            delay={0.28}
            medicalDates={new Set(reportsByDate.keys())}
          />
        </div>
        <div className="min-w-0 md:h-full">
          <DayDetail
            dateIso={selectedIso}
            entries={selectedEntries}
            targets={user.targets}
            medicalReports={selectedReports}
            onSelectEntry={setSelectedEntry}
            delay={0.33}
          />
        </div>
      </div>

      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onChanged={refresh}
        />
      )}

      <LogEntrySheet open={logOpen} onClose={() => setLogOpen(false)} />
    </div>
  );
}
