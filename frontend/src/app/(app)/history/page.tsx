"use client";

import { useEffect, useMemo, useState } from "react";
import { getAllEntries } from "@/lib/api";
import { deleteEntry, restoreEntry, updateEntry } from "@/lib/store";
import { Skeleton, useToast } from "@/components/ui";
import { getToday } from "@/lib/date";
import { mockUser } from "@/lib/mock-data";
import {
  buildMonthGrid,
  groupByDate,
  weekSummary,
} from "@/lib/history";
import type { IntakeEntry } from "@/lib/types";
import { WeekSummaryCard } from "@/components/history/WeekSummaryCard";
import { MonthCalendar } from "@/components/history/MonthCalendar";
import { DayDetail } from "@/components/history/DayDetail";
import { EditEntryDialog } from "@/components/history/EditEntryDialog";

const targets = mockUser.targets;

export default function HistoryPage() {
  const [entries, setEntries] = useState<IntakeEntry[] | null>(null);
  const todayIso = getToday();
  const [ty, tm] = [Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7)) - 1];
  const [cursor, setCursor] = useState({ year: ty, month0: tm });
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [editing, setEditing] = useState<IntakeEntry | null>(null);

  useEffect(() => {
    getAllEntries().then(setEntries);
  }, []);

  const byDate = useMemo(
    () => groupByDate(entries ?? []),
    [entries],
  );

  const grid = useMemo(
    () => buildMonthGrid(cursor.year, cursor.month0, byDate, targets, todayIso),
    [cursor, byDate, todayIso],
  );

  const week = useMemo(
    () => weekSummary(byDate, targets, todayIso),
    [byDate, todayIso],
  );

  const monthLabel = new Date(cursor.year, cursor.month0, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );

  const selectedEntries = byDate.get(selectedIso) ?? [];

  const { toast } = useToast();

  function refresh() {
    getAllEntries().then(setEntries);
  }

  function handleDelete(id: string) {
    const removed = (entries ?? []).find((e) => e.id === id);
    deleteEntry(id);
    refresh();
    toast({
      title: "Entry deleted",
      description: removed?.name,
      variant: "info",
      action: removed
        ? {
            label: "Undo",
            onClick: () => {
              restoreEntry(removed);
              refresh();
            },
          }
        : undefined,
    });
  }

  function handleSaveEdit(id: string, patch: Partial<IntakeEntry>) {
    updateEntry(id, patch);
    refresh();
    toast({ title: "Entry updated", variant: "success" });
  }

  function stepMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month0 + delta, 1);
      return { year: d.getFullYear(), month0: d.getMonth() };
    });
  }

  if (!entries) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-[24px] font-extrabold tracking-tight text-ink">History</h1>
        <div className="grid gap-4 md:grid-cols-[1fr_340px] md:gap-6">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-80" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-[22px] font-extrabold tracking-tight text-ink md:text-[24px]">
        History
      </h1>

      <div className="grid gap-4 md:grid-cols-[1fr_340px] md:gap-6">
        <div className="flex flex-col gap-4">
          <WeekSummaryCard summary={week} />
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

        <DayDetail
          dateIso={selectedIso}
          entries={selectedEntries}
          targets={targets}
          onEdit={setEditing}
          onDelete={handleDelete}
        />
      </div>

      {editing && (
        <EditEntryDialog
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
