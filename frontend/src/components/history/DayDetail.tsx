import {
  Card,
  Badge,
  SourceBadge,
  ScrollArea,
  type BadgeTone,
} from "@/components/ui";
import { CupIcon, FileTextIcon, UtensilsIcon } from "@/components/icons";
import { formatDateLong, formatNumber, formatTime } from "@/lib/format";
import {
  calendarLabel,
  calendarStatus,
  type CalendarStatus,
} from "@/lib/history";
import { buildDailyTotals, sugarBand } from "@/lib/nutrition";
import type {
  IntakeEntry,
  MedicalReportSummary,
  NutritionTargets,
} from "@/lib/types";
import { cn } from "@/lib/cn";

const statusTone: Record<CalendarStatus, BadgeTone> = {
  within: "teal",
  elevated: "amber",
  moderate: "orange",
  significant: "red",
  incomplete: "blue",
  none: "neutral",
};

const sugarAccent: Record<
  ReturnType<typeof sugarBand>,
  "teal" | "amber" | "orange" | "red"
> = {
  ok: "teal",
  yellow: "amber",
  orange: "orange",
  red: "red",
};

/** Visible entry rows before scrolling. */
const VISIBLE_ENTRIES = 3;
/** Approx. row height (py-2.5 + 32px icon). */
const ENTRY_ROW_PX = 58;

function reportHighlights(report: MedicalReportSummary): string {
  const bits: string[] = [];
  if (report.hba1c != null) bits.push(`HbA1c ${report.hba1c}%`);
  if (report.fasting_glucose != null) {
    bits.push(`FBG ${report.fasting_glucose}`);
  }
  if (report.ldl != null) bits.push(`LDL ${report.ldl}`);
  return bits.length ? bits.join(" · ") : "Lab metrics saved";
}

export function DayDetail({
  dateIso,
  entries,
  targets,
  medicalReports = [],
  onSelectEntry,
  delay = 0,
}: {
  dateIso: string;
  entries: IntakeEntry[];
  targets: NutritionTargets;
  medicalReports?: MedicalReportSummary[];
  onSelectEntry?: (entry: IntakeEntry) => void;
  delay?: number;
}) {
  const totals = buildDailyTotals(dateIso, entries, targets);
  const status = calendarStatus(totals, targets);
  const nonWater = entries
    .filter((e) => e.type !== "water")
    .sort((a, b) => (a.loggedAt < b.loggedAt ? -1 : 1));
  const needsScroll = nonWater.length > VISIBLE_ENTRIES;
  const empty = totals.entryCount === 0 && medicalReports.length === 0;

  return (
    <Card className="w-full self-start p-4 md:p-5" delay={delay} quiet>
      <div className="mb-1 flex min-h-[28px] items-center justify-between gap-2">
        <span className="text-[16px] font-extrabold text-ink">
          {formatDateLong(dateIso)}
        </span>
        {status !== "none" && (
          <Badge tone={statusTone[status]}>{calendarLabel[status]}</Badge>
        )}
      </div>

      {empty ? (
        <p className="flex flex-1 items-center justify-center py-8 text-center text-[13px] font-medium text-ink-3">
          No entries logged on this day.
        </p>
      ) : (
        <>
          {totals.entryCount > 0 && (
            <div className="my-3 grid shrink-0 grid-cols-3 gap-2">
              <Metric
                label="Calories"
                value={formatNumber(totals.calories)}
                sub={`/ ${formatNumber(targets.calories)}`}
              />
              <Metric
                label="Hydration"
                value={`${totals.water_cups}`}
                sub={`/ ${targets.water_cups} cups`}
                accent="blue"
              />
              <Metric
                label="Protein"
                value={`${totals.protein_g}`}
                sub="g"
              />
              <Metric
                label="Sugar"
                value={`${totals.totalSugar_g}`}
                sub={`/ ${targets.sugar_g} g`}
                accent={
                  sugarAccent[sugarBand(totals.totalSugar_g, targets.sugar_g)]
                }
              />
              <Metric
                label="Carbs"
                value={`${totals.carbs_g}`}
                sub="g"
              />
              <Metric
                label="Fat"
                value={`${totals.fat_g}`}
                sub="g"
              />
            </div>
          )}

          {medicalReports.length > 0 && (
            <div className="mb-3">
              <div className="mb-1.5 shrink-0 text-[11px] font-bold tracking-wide text-ink-3">
                MEDICAL REPORTS · {medicalReports.length}
              </div>
              <ul className="overflow-hidden rounded-[12px] border border-line">
                {medicalReports.map((report, i) => (
                  <li
                    key={report.id}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5",
                      i < medicalReports.length - 1 ? "border-b border-line" : "",
                    )}
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-amber-t text-amber-d">
                      <FileTextIcon size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold text-ink">
                        Lab report #{report.id}
                      </div>
                      <div className="truncate text-[10.5px] font-medium text-ink-3">
                        {reportHighlights(report)}
                      </div>
                    </div>
                    {report.file_path ? (
                      <a
                        href={
                          report.file_path.startsWith("/uploads/")
                            ? report.file_path
                            : `/uploads/${report.file_path.split(/[/\\]/).pop()}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-teal-d"
                      >
                        View
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {nonWater.length > 0 && (
            <>
              <div className="mb-1.5 shrink-0 text-[11px] font-bold tracking-wide text-ink-3">
                ENTRIES · {nonWater.length}
              </div>

              <ScrollArea
                style={
                  needsScroll
                    ? { maxHeight: VISIBLE_ENTRIES * ENTRY_ROW_PX }
                    : undefined
                }
              >
                <ul>
                  {nonWater.map((entry, i) => {
                    return (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() => onSelectEntry?.(entry)}
                          className={cn(
                            "flex w-full items-center gap-2.5 py-2.5 text-left transition hover:bg-app-bg/80",
                            i < nonWater.length - 1 ? "border-b border-line" : "",
                          )}
                        >
                          <EntryThumb entry={entry} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[12.5px] font-semibold text-ink">
                                {entry.name}
                              </span>
                              <SourceBadge source={entry.source} />
                            </div>
                            <div className="text-[10.5px] font-medium text-ink-3">
                              {formatTime(entry.loggedAt)}
                            </div>
                          </div>
                          <span className="text-[11.5px] font-semibold text-ink-3">
                            {formatNumber(entry.nutrients.calories)} kcal
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
              {needsScroll && (
                <p className="mt-2 text-center text-[11px] font-medium text-ink-3">
                  Scroll for more entries
                </p>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}

/** Icon-sized leading thumb — photo when saved, else type icon. */
function EntryThumb({ entry }: { entry: IntakeEntry }) {
  const Icon = entry.type === "drink" ? CupIcon : UtensilsIcon;
  const tone =
    entry.type === "drink" ? "bg-blue-t text-blue-d" : "bg-teal-t text-teal-d";

  if (entry.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={entry.imageUrl}
        alt=""
        className="h-8 w-8 shrink-0 rounded-[10px] object-cover"
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
        tone,
      )}
    >
      <Icon size={15} />
    </span>
  );
}

function Metric({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: "amber" | "blue" | "teal" | "orange" | "red";
}) {
  const labelColor =
    accent === "amber"
      ? "text-amber-d"
      : accent === "blue"
        ? "text-blue-d"
        : accent === "teal"
          ? "text-teal-d"
          : accent === "orange"
            ? "text-orange-d"
            : accent === "red"
              ? "text-red-d"
              : "text-ink-3";
  return (
    <div className="flex min-h-[72px] flex-col items-center justify-center rounded-[11px] bg-app-bg px-2.5 py-2.5 text-center">
      <div className={`text-[10px] font-semibold uppercase tracking-wide ${labelColor}`}>
        {label}
      </div>
      <div className="mt-1 text-[16px] font-extrabold leading-none text-ink tabular-nums">
        {value}
      </div>
      <div className="mt-1 min-h-[14px] text-[10px] font-semibold leading-none text-ink-3 tabular-nums">
        {sub}
      </div>
    </div>
  );
}

