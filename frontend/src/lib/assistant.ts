import { computeInsights } from "./analytics";
import { formatDateLong } from "./format";
import type { IntakeEntry, NutritionTargets } from "./types";

/**
 * Mock nutrition assistant.
 *
 * Answers a handful of intents from confirmed logs. Every answer states the
 * data period, distinguishes confirmed vs estimated data, and never diagnoses,
 * prescribes, or makes causal claims. Swap `answerQuestion` for a RAG/LLM call
 * later — keep the `AssistantMessage` shape.
 */

export interface AssistantBar {
  label: string;
  percent: number;
}

export interface AssistantMessage {
  role: "user" | "assistant";
  text: string;
  bars?: AssistantBar[];
  /** Short data-period note shown as a badge. */
  period?: string;
  /** A cautionary/limitation note shown separately. */
  note?: string;
}

export const suggestedQuestions = [
  "Which drinks contributed most to my sugar?",
  "How did this week compare with last week?",
  "What is HbA1c?",
  "Which entries were estimates?",
];

function periodLabel(endIso: string, days: number): string {
  const start = new Date(`${endIso}T00:00:00`);
  start.setDate(start.getDate() - (days - 1));
  const startTxt = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endTxt = formatDateLong(endIso).replace(/^\w+,\s/, "");
  return `Confirmed data · ${startTxt}–${endTxt}`;
}

export function greetingMessage(): AssistantMessage {
  return {
    role: "assistant",
    text: "Hi! I answer from your confirmed logs. Ask about your sugar sources, weekly trends, which entries were estimates, or general nutrition questions.",
  };
}

export function answerQuestion(
  question: string,
  entries: IntakeEntry[],
  targets: NutritionTargets,
  endIso: string,
): AssistantMessage {
  const q = question.toLowerCase();
  const data = computeInsights(entries, targets, endIso, 7);
  const period = periodLabel(endIso, 7);

  const dataNote =
    data.dataQuality.completeDays < data.dataQuality.totalDays
      ? `Only ${data.dataQuality.completeDays} of the last ${data.dataQuality.totalDays} days are fully logged, so this may be underestimated.`
      : undefined;

  // Sugar sources
  if (q.includes("sugar") || q.includes("drink")) {
    if (data.sources.length === 0) {
      return {
        role: "assistant",
        text: "I don't see any sweetened drinks in your confirmed logs for this period.",
        period,
      };
    }
    const top = data.sources[0];
    return {
      role: "assistant",
      text: `From your confirmed entries, ${top.name.toLowerCase()} was your biggest drink-sugar source at ${top.percent}%.`,
      bars: data.sources.map((s) => ({ label: s.name, percent: s.percent })),
      period,
      note: dataNote,
    };
  }

  // Week comparison
  if (q.includes("week") || q.includes("compare") || q.includes("trend")) {
    if (data.weekOverWeekPercent === null) {
      return {
        role: "assistant",
        text: "There isn't enough data yet to compare this week with last week.",
        period,
      };
    }
    const dir =
      data.weekOverWeekPercent <= 0
        ? `down ${Math.abs(data.weekOverWeekPercent)}%`
        : `up ${data.weekOverWeekPercent}%`;
    return {
      role: "assistant",
      text: `Your added sugar is ${dir} compared with the previous week. You stayed within target on ${data.dataQuality.completeDays} of the last ${data.dataQuality.totalDays} logged days.`,
      period,
      note: dataNote,
    };
  }

  // HbA1c explainer (educational, no diagnosis)
  if (q.includes("hba1c") || q.includes("a1c")) {
    return {
      role: "assistant",
      text: "HbA1c is a lab measure that reflects your average blood sugar over roughly the past 2–3 months. It's expressed as a percentage. I can share general information, but I don't diagnose or interpret your results — discuss any specific values with a qualified healthcare professional.",
    };
  }

  // Which entries were estimates
  if (q.includes("estimate")) {
    const aiCount = entries.filter((e) => e.source === "ai").length;
    return {
      role: "assistant",
      text: `${aiCount} of your entries are AI estimates (from food photos). The rest come from labels or manual entry, which are treated as confirmed values.`,
      period,
    };
  }

  // Lower-sugar alternative
  if (q.includes("alternative") || q.includes("replace") || q.includes("lower")) {
    return {
      role: "assistant",
      text: "If you'd like a lower-sugar swap, an unsweetened sparkling water or a plain coffee/tea keeps caffeine similar with little to no added sugar. This is general information, not personalised advice.",
      period,
    };
  }

  // Questions for a professional
  if (q.includes("professional") || q.includes("doctor") || q.includes("ask")) {
    return {
      role: "assistant",
      text: "A few questions you might bring to a healthcare professional: \u201cIs my added-sugar target appropriate for me?\u201d, \u201cHow do my weekend eating patterns fit my overall goals?\u201d, and \u201cAre there results I should monitor over time?\u201d",
    };
  }

  // Fallback
  return {
    role: "assistant",
    text: "I can answer from your confirmed logs — try asking about your top sugar sources, how this week compares with last week, or which entries were AI estimates.",
    period,
  };
}
