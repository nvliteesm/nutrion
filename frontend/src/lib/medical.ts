import type { MedicalMetric } from "./types";

/** True when the value falls outside the printed reference range. */
export function outOfRange(metric: MedicalMetric): boolean {
  if (metric.refLow !== undefined && metric.value < metric.refLow) return true;
  if (metric.refHigh !== undefined && metric.value > metric.refHigh) return true;
  return false;
}

export const MEDICAL_DISCLAIMER =
  "NutriON provides educational information and does not diagnose medical conditions. Discuss abnormal or concerning results with a qualified healthcare professional.";

/**
 * A cautious, non-causal nutrition-linked insight.
 *
 * Only produced when a confirmed metric is out of range AND there's a related
 * nutrition pattern. Never claims causation and never changes any goals.
 */
export function linkedInsight(
  confirmedMetrics: MedicalMetric[],
  afternoonSweetDrinkDays: number,
): string | null {
  const hba1c = confirmedMetrics.find((m) => m.id === "hba1c");
  if (hba1c && outOfRange(hba1c) && afternoonSweetDrinkDays >= 3) {
    return "Your confirmed report shows an HbA1c above the printed reference range. Your recent logs also show frequent sweetened-drink consumption. Consider discussing this pattern with a healthcare professional.";
  }
  const anyOut = confirmedMetrics.some(outOfRange);
  if (anyOut) {
    return "One or more confirmed values appear outside the printed reference range. Consider discussing these results with a healthcare professional.";
  }
  return null;
}
