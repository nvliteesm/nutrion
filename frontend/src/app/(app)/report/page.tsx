"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, ProgressBar } from "@/components/ui";
import {
  DownloadIcon,
  FileTextIcon,
  InfoIcon,
  SparkleIcon,
} from "@/components/icons";
import { getAllEntries } from "@/lib/api";
import { getStoredSession } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { mockUser, MOCK_TODAY } from "@/lib/mock-data";
import { generateReport, type PersonalReport } from "@/lib/report";
import type { IntakeEntry, Subscription } from "@/lib/types";

const PERIODS = [7, 30, 90] as const;

export default function ReportPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [entries, setEntries] = useState<IntakeEntry[]>([]);
  const [period, setPeriod] = useState<number>(30);

  useEffect(() => {
    setSubscription(getStoredSession()?.subscription ?? "free");
    getAllEntries().then(setEntries);
  }, []);

  const report: PersonalReport | null = useMemo(
    () =>
      entries.length
        ? generateReport(mockUser.fullName, entries, mockUser.targets, MOCK_TODAY, period)
        : null,
    [entries, period],
  );

  if (subscription === null) {
    return <div className="h-40 animate-pulse rounded-card-lg bg-black/[0.05]" />;
  }

  if (subscription !== "premium") {
    return (
      <Card className="p-6 text-center">
        <h1 className="text-[18px] font-extrabold text-ink">
          Personal reports are Premium
        </h1>
        <p className="mx-auto mt-2 max-w-[320px] text-[13px] font-medium text-ink-2">
          Generate a downloadable summary of your nutrition patterns, confirmed
          metrics, and questions for a professional.
        </p>
        <Link
          href="/premium"
          className="mt-4 inline-block rounded-card-sm bg-teal px-5 py-3 text-[14px] font-bold text-white"
        >
          Go Premium
        </Link>
      </Card>
    );
  }

  if (!report) {
    return <div className="h-40 animate-pulse rounded-card-lg bg-black/[0.05]" />;
  }

  function handleDownload() {
    // In a real build this invokes a PDF library (e.g. react-pdf or server-side).
    // For the hackathon, this opens the browser print dialog as a stand-in.
    window.print();
  }

  return (
    <div className="mx-auto max-w-[660px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink">
            Personal nutrition report
          </h1>
          <Badge tone="amber">
            <SparkleIcon size={10} />
            PREMIUM
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-[9px] px-3 py-1.5 text-[12px] font-bold transition-colors ${
                  period === p
                    ? "bg-navy text-white"
                    : "border border-line-2 font-semibold text-ink-2"
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
          <Button size="sm" variant="navy" onClick={handleDownload}>
            <DownloadIcon size={14} />
            Download PDF
          </Button>
        </div>
      </div>

      <Card className="p-6 print:shadow-none">
        <div className="mb-5 border-b border-line pb-5">
          <div className="text-[18px] font-extrabold text-ink">
            {report.fullName}
          </div>
          <div className="mt-1 text-[12.5px] font-medium text-ink-2">
            {report.periodLabel} · {report.periodDays}-day summary
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatBlock value={formatNumber(report.avgCalories)} label="avg kcal / day" />
          <StatBlock value={`${report.avgAddedSugar} g`} label="avg added sugar" />
          <StatBlock
            value={`${report.daysWithinTarget} / ${report.totalDays}`}
            label="days within target"
          />
          <StatBlock value={`${report.loggingCompleteness}%`} label="logging complete" />
        </div>

        {report.keyPatterns.length > 0 && (
          <Section title="KEY PATTERNS">
            <ul className="list-disc space-y-1 pl-4">
              {report.keyPatterns.map((p, i) => (
                <li key={i} className="text-[13px] font-medium leading-relaxed text-ink">
                  {p}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {report.topSugarSources.length > 0 && (
          <Section title="TOP SUGAR SOURCES">
            <ul className="list-disc space-y-1 pl-4">
              {report.topSugarSources.map((s, i) => (
                <li key={i} className="text-[13px] font-medium text-ink">{s}</li>
              ))}
            </ul>
          </Section>
        )}

        {report.confirmedMetrics.length > 0 && (
          <Section title="CONFIRMED MEDICAL METRICS">
            <div className="flex flex-wrap gap-2">
              {report.confirmedMetrics.map((m) => (
                <Badge
                  key={m.id}
                  tone={report.outOfRangeMetrics.includes(m.name) ? "amber" : "teal"}
                >
                  {m.name}: {m.value} {m.unit}
                </Badge>
              ))}
            </div>
          </Section>
        )}

        <Section title="QUESTIONS YOU MIGHT ASK A HEALTHCARE PROFESSIONAL">
          <ul className="list-disc space-y-1 pl-4">
            {report.questionsForProfessional.map((q, i) => (
              <li key={i} className="text-[13px] font-medium text-ink">{q}</li>
            ))}
          </ul>
        </Section>

        <div className="mt-5 flex items-start gap-2 rounded-card bg-app-bg px-4 py-3">
          <InfoIcon size={16} className="mt-px shrink-0 text-ink-3" />
          <p className="text-[11.5px] font-medium leading-relaxed text-ink-2">
            {report.disclaimer} Only {report.loggingCompleteness}% of days are
            fully logged; averages may be affected.
          </p>
        </div>
      </Card>
    </div>
  );
}

function StatBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-[13px] bg-app-bg px-3.5 py-3">
      <div className="text-[20px] font-extrabold text-ink">{value}</div>
      <div className="text-[11px] font-semibold text-ink-3">{label}</div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-[11px] font-bold tracking-wide text-ink-3">
        {title}
      </div>
      {children}
    </div>
  );
}
