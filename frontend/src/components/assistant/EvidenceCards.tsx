"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Badge, LineChart, ProgressBar } from "@/components/ui";
import {
  AlertTriangleIcon,
  ChartIcon,
  CupIcon,
  FileTextIcon,
  UtensilsIcon,
} from "@/components/icons";
import type { AssistantCard } from "@/lib/assistant";
import { cn } from "@/lib/cn";

/** Interactive evidence cards — separate panels below the answer text. */
export function EvidenceCards({
  cards,
  onAsk,
  compact = false,
}: {
  cards: AssistantCard[];
  onAsk?: (question: string) => void;
  compact?: boolean;
}) {
  if (!cards.length) return null;

  const actions = cards.filter((c) => c.type === "actions");
  const sources = cards.filter((c) => c.type === "sources");
  const main = cards.filter((c) => c.type !== "actions" && c.type !== "sources");

  return (
    <div className={cn("flex w-full flex-col", compact ? "gap-2.5" : "gap-3.5")}>
      <div
        className={cn(
          "grid w-full",
          compact
            ? "grid-cols-1 gap-2.5"
            : "grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3",
        )}
      >
        {main.map((card, i) => (
          <motion.div
            key={`${card.type}-${i}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.2) }}
            className={cn(
              !compact &&
                (card.type === "sugar_sources" ||
                  card.type === "trend" ||
                  card.type === "comparison") &&
                "md:col-span-2 xl:col-span-2",
            )}
          >
            <CardSwitch card={card} onAsk={onAsk} compact={compact} />
          </motion.div>
        ))}
      </div>

      {sources.map((card, i) => (
        <CardSwitch
          key={`sources-${i}`}
          card={card}
          onAsk={onAsk}
          compact={compact}
        />
      ))}

      {actions.map((card, i) => (
        <CardSwitch
          key={`actions-${i}`}
          card={card}
          onAsk={onAsk}
          compact={compact}
        />
      ))}
    </div>
  );
}

function CardSwitch({
  card,
  onAsk,
  compact,
}: {
  card: AssistantCard;
  onAsk?: (question: string) => void;
  compact: boolean;
}) {
  switch (card.type) {
    case "summary":
      return <SummaryCard card={card} compact={compact} />;
    case "sugar_sources":
      return <SugarSourcesCard card={card} onAsk={onAsk} compact={compact} />;
    case "trend":
      return <TrendCard card={card} compact={compact} />;
    case "comparison":
      return <ComparisonCard card={card} compact={compact} />;
    case "completeness":
      return <CompletenessCard card={card} onAsk={onAsk} compact={compact} />;
    case "medical":
      return <MedicalCard card={card} onAsk={onAsk} compact={compact} />;
    case "knowledge":
      return <KnowledgeCard card={card} onAsk={onAsk} compact={compact} />;
    case "sources":
      return <SourcesCard card={card} compact={compact} />;
    case "actions":
      return <ActionsCard card={card} onAsk={onAsk} compact={compact} />;
    default:
      return null;
  }
}

function Shell({
  title,
  icon,
  children,
  compact,
  accent = "teal",
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  compact: boolean;
  accent?: "teal" | "amber" | "blue" | "navy";
}) {
  const accents = {
    teal: "bg-teal-t text-teal-d",
    amber: "bg-amber-t text-amber-d",
    blue: "bg-blue-t text-blue-d",
    navy: "bg-navy/10 text-navy",
  };

  return (
    <div className="h-full overflow-hidden rounded-2xl border border-line bg-card shadow-card-lg">
      <div
        className={cn(
          "flex items-center gap-2.5 border-b border-line bg-gradient-to-r from-navy/[0.04] to-transparent",
          compact ? "px-3.5 py-2.5" : "px-4 py-3",
        )}
      >
        {icon && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-lg",
              accents[accent],
              compact ? "h-7 w-7" : "h-8 w-8",
            )}
          >
            {icon}
          </span>
        )}
        <span
          className={cn(
            "font-bold tracking-tight text-ink",
            compact ? "text-[12.5px]" : "text-[13.5px]",
          )}
        >
          {title}
        </span>
      </div>
      <div className={cn(compact ? "px-3.5 py-3" : "px-4 py-4")}>{children}</div>
    </div>
  );
}

function SummaryCard({
  card,
  compact,
}: {
  card: Extract<AssistantCard, { type: "summary" }>;
  compact: boolean;
}) {
  return (
    <Shell
      title={card.title}
      icon={<ChartIcon size={compact ? 14 : 16} />}
      compact={compact}
      accent="teal"
    >
      {card.period && (
        <div className="mb-3">
          <Badge tone="teal">{card.period}</Badge>
        </div>
      )}
      <div
        className={cn(
          "grid gap-2.5",
          compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4",
        )}
      >
        {card.stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-line bg-app-bg px-3 py-3"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
              {s.label}
            </div>
            <div
              className={cn(
                "mt-1 font-extrabold tracking-tight text-ink",
                compact ? "text-[16px]" : "text-[18px]",
              )}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>
      {card.mealCount > 0 && (
        <div className="mt-3 text-[12px] font-medium text-ink-3">
          {card.mealCount} confirmed meal{card.mealCount === 1 ? "" : "s"}
        </div>
      )}
    </Shell>
  );
}

function SugarSourcesCard({
  card,
  onAsk,
  compact,
}: {
  card: Extract<AssistantCard, { type: "sugar_sources" }>;
  onAsk?: (question: string) => void;
  compact: boolean;
}) {
  const items = compact ? card.items.slice(0, 3) : card.items;
  return (
    <Shell
      title={card.title}
      icon={<CupIcon size={compact ? 14 : 16} />}
      compact={compact}
      accent="amber"
    >
      <div className="mb-3 text-[12.5px] font-medium text-ink-2">
        {Math.round(card.totalSugarG * 10) / 10}g sugar in period — tap a row for
        detail
      </div>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => {
          const Icon = item.inputType === "drink" ? CupIcon : UtensilsIcon;
          return (
            <li key={item.name}>
              <button
                type="button"
                disabled={!onAsk}
                onClick={() =>
                  onAsk?.(
                    `Tell me more about how "${item.name}" contributed to my sugar.`,
                  )
                }
                className="w-full rounded-xl border border-line bg-app-bg px-3.5 py-3 text-left transition hover:border-teal/40 hover:bg-card disabled:hover:border-line disabled:hover:bg-app-bg"
              >
                <div className="mb-2 flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-t text-amber-d">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink">
                    {item.name}
                  </span>
                  <span className="shrink-0 text-[14px] font-extrabold text-ink">
                    {Math.round(item.sugarG * 10) / 10}g
                  </span>
                </div>
                <ProgressBar
                  value={item.percent}
                  max={100}
                  height={7}
                  colorClass="bg-amber"
                />
                <div className="mt-1.5 flex items-center justify-between text-[11.5px] font-medium text-ink-3">
                  <span>{item.percent}% of period sugar</span>
                  {item.estimated && <Badge tone="amber">Estimate</Badge>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

function TrendCard({
  card,
  compact,
}: {
  card: Extract<AssistantCard, { type: "trend" }>;
  compact: boolean;
}) {
  return (
    <Shell
      title={card.title}
      icon={<ChartIcon size={compact ? 14 : 16} />}
      compact={compact}
      accent="teal"
    >
      {card.changePercent != null && (
        <div className="mb-2 text-[12.5px] font-semibold text-ink-2">
          vs prior period:{" "}
          <span
            className={
              card.changePercent > 0
                ? "text-red-d"
                : card.changePercent < 0
                  ? "text-teal-d"
                  : "text-ink"
            }
          >
            {card.changePercent > 0 ? "+" : ""}
            {Math.round(card.changePercent)}%
          </span>
        </div>
      )}
      <LineChart
        data={card.points}
        height={compact ? 100 : 140}
        unit={card.unit}
        colorClass="text-teal"
      />
    </Shell>
  );
}

function ComparisonCard({
  card,
  compact,
}: {
  card: Extract<AssistantCard, { type: "comparison" }>;
  compact: boolean;
}) {
  return (
    <Shell
      title={card.title}
      icon={<ChartIcon size={compact ? 14 : 16} />}
      compact={compact}
      accent="blue"
    >
      <div className="mb-3 flex flex-wrap gap-2 text-[11.5px] font-medium">
        <span className="rounded-full bg-teal-t px-2.5 py-1 text-teal-d">
          Now: {card.currentLabel}
        </span>
        <span className="rounded-full bg-navy/[0.07] px-2.5 py-1 text-ink-2">
          Prev: {card.previousLabel}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {card.rows.map((row) => {
          const delta = row.changePercent;
          return (
            <li
              key={row.label}
              className="flex items-center gap-3 rounded-xl border border-line bg-app-bg px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-ink">
                  {row.label}
                </div>
                <div className="mt-0.5 text-[12px] font-medium text-ink-3">
                  {Math.round(row.previous * 10) / 10}
                  {row.unit} → {Math.round(row.current * 10) / 10}
                  {row.unit}
                </div>
              </div>
              {delta != null && (
                <span
                  className={`text-[14px] font-extrabold ${
                    delta > 0
                      ? "text-red-d"
                      : delta < 0
                        ? "text-teal-d"
                        : "text-ink-3"
                  }`}
                >
                  {delta > 0 ? "+" : ""}
                  {Math.round(delta)}%
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

function CompletenessCard({
  card,
  onAsk,
  compact,
}: {
  card: Extract<AssistantCard, { type: "completeness" }>;
  onAsk?: (question: string) => void;
  compact: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  const days = compact ? card.incompleteDays.slice(0, 4) : card.incompleteDays;
  const tone =
    card.percent >= 80 ? "teal" : card.percent >= 50 ? "amber" : "red";

  return (
    <Shell
      title={card.title}
      icon={<AlertTriangleIcon size={compact ? 14 : 16} />}
      compact={compact}
      accent="amber"
    >
      <div className="mb-2.5 flex items-end justify-between gap-3">
        <div>
          <div
            className={cn(
              "font-extrabold leading-none tracking-tight text-ink",
              compact ? "text-[28px]" : "text-[34px]",
            )}
          >
            {Math.round(card.percent)}%
          </div>
          <div className="mt-1.5 text-[12.5px] font-medium text-ink-3">
            {card.daysWithLogs}/{card.expectedDays} days logged
          </div>
        </div>
        <Badge tone={tone}>
          {card.percent >= 80
            ? "Strong"
            : card.percent >= 50
              ? "Partial"
              : "Sparse"}
        </Badge>
      </div>
      <ProgressBar
        value={card.percent}
        max={100}
        height={8}
        colorClass={
          tone === "teal" ? "bg-teal" : tone === "amber" ? "bg-amber" : "bg-red"
        }
      />
      {card.incompleteDays.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[12.5px] font-semibold text-teal-d hover:underline"
          >
            {open ? "Hide" : "Show"} incomplete days ({card.incompleteDays.length})
          </button>
          {open && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  disabled={!onAsk}
                  onClick={() =>
                    onAsk?.(`What did I log on ${d}, and was it incomplete?`)
                  }
                  className="rounded-full border border-line bg-app-bg px-2.5 py-1 text-[11.5px] font-semibold text-ink-2 hover:border-teal/40 hover:bg-card disabled:hover:border-line"
                >
                  {formatChipDate(d)}
                </button>
              ))}
              {compact && card.incompleteDays.length > days.length && (
                <span className="px-1 text-[11px] font-medium text-ink-3">
                  +{card.incompleteDays.length - days.length}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

function MedicalCard({
  card,
  onAsk,
  compact,
}: {
  card: Extract<AssistantCard, { type: "medical" }>;
  onAsk?: (question: string) => void;
  compact: boolean;
}) {
  const metrics = compact ? card.metrics.slice(0, 3) : card.metrics;
  return (
    <Shell
      title={card.title}
      icon={<FileTextIcon size={compact ? 14 : 16} />}
      compact={compact}
      accent="blue"
    >
      <ul className="flex flex-col gap-2">
        {metrics.map((m) => {
          const tone =
            m.status === "high" || m.status === "low"
              ? "amber"
              : m.status === "normal"
                ? "teal"
                : "neutral";
          return (
            <li key={m.name}>
              <button
                type="button"
                disabled={!onAsk}
                onClick={() =>
                  onAsk?.(
                    `What does my ${m.name} of ${m.value} ${m.unit} mean educationally?`,
                  )
                }
                className="flex w-full items-center gap-3 rounded-xl border border-line bg-app-bg px-3.5 py-3 text-left transition hover:border-teal/40 hover:bg-card disabled:hover:border-line"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold text-ink">
                    {m.name}
                  </div>
                  {m.range && (
                    <div className="mt-0.5 text-[11.5px] font-medium text-ink-3">
                      Ref {m.range}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[15px] font-extrabold text-ink">
                    {m.value}
                    <span className="ml-1 text-[11px] font-semibold text-ink-3">
                      {m.unit}
                    </span>
                  </div>
                  <Badge tone={tone} className="mt-1 capitalize">
                    {m.status}
                  </Badge>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

function KnowledgeCard({
  card,
  onAsk,
  compact,
}: {
  card: Extract<AssistantCard, { type: "knowledge" }>;
  onAsk?: (question: string) => void;
  compact: boolean;
}) {
  const items = compact ? card.items.slice(0, 1) : card.items;
  return (
    <Shell
      title={card.title}
      icon={<FileTextIcon size={compact ? 14 : 16} />}
      compact={compact}
      accent="navy"
    >
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li
            key={item.title}
            className="rounded-xl border border-line bg-app-bg px-3.5 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13.5px] font-bold text-ink">
                  {item.title}
                </div>
                {item.topic && (
                  <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
                    {item.topic}
                  </div>
                )}
              </div>
              {onAsk && (
                <button
                  type="button"
                  onClick={() => onAsk(`Explain more about ${item.title}`)}
                  className="shrink-0 rounded-lg bg-teal px-2.5 py-1 text-[11.5px] font-bold text-white hover:opacity-90"
                >
                  Ask
                </button>
              )}
            </div>
            {item.snippet && (
              <p className="mt-2 text-[12.5px] font-medium leading-relaxed text-ink-2">
                {item.snippet}
                {item.snippet.length >= 180 ? "…" : ""}
              </p>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function SourcesCard({
  card,
  compact,
}: {
  card: Extract<AssistantCard, { type: "sources" }>;
  compact: boolean;
}) {
  const [open, setOpen] = useState(!compact);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-full border border-line bg-card px-3 py-1.5 text-[12px] font-semibold text-ink-2 shadow-card hover:text-ink"
      >
        {card.items.length} source{card.items.length === 1 ? "" : "s"} used ▸
      </button>
    );
  }
  return (
    <Shell title={card.title} compact={compact} accent="navy">
      <div className="flex flex-wrap gap-1.5">
        {card.items.map((s, i) => (
          <Badge key={`${s.label}-${i}`} tone={sourceTone(s.kind)}>
            {prettyLabel(s.label)}
            {s.detail ? ` · ${truncate(s.detail, 36)}` : ""}
          </Badge>
        ))}
      </div>
    </Shell>
  );
}

function ActionsCard({
  card,
  onAsk,
  compact,
}: {
  card: Extract<AssistantCard, { type: "actions" }>;
  onAsk?: (question: string) => void;
  compact: boolean;
}) {
  if (!onAsk) return null;
  return (
    <div>
      <div
        className={cn(
          "mb-2 font-semibold text-ink-3",
          compact ? "text-[11px]" : "text-[12px]",
        )}
      >
        {card.title}
      </div>
      <div className="flex flex-wrap gap-2">
        {card.actions.map((a) => (
          <button
            key={a.question}
            type="button"
            onClick={() => onAsk(a.question)}
            className={cn(
              "rounded-full bg-navy font-semibold text-white shadow-card transition hover:bg-navy-2",
              compact ? "px-3 py-1.5 text-[11.5px]" : "px-3.5 py-2 text-[12.5px]",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatChipDate(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function sourceTone(
  kind: string,
): "teal" | "blue" | "amber" | "navy" | "neutral" {
  if (kind === "medical") return "amber";
  if (kind === "knowledge") return "blue";
  if (kind === "analytics") return "teal";
  return "neutral";
}

function prettyLabel(label: string): string {
  return label.replace(/_/g, " ");
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
