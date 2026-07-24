import type { MedicalMetric, MedicalReportSummary } from "./types";

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
  const hba1c = confirmedMetrics.find((m) =>
    /hba1c|hb\s*a1c|a1c/i.test(m.name),
  );
  if (hba1c && outOfRange(hba1c) && afternoonSweetDrinkDays >= 3) {
    return "Your logs show frequent high-sugar drinks in the afternoon, and your uploaded report contains a confirmed HbA1c value outside its printed reference range. NutriON cannot determine whether one caused the other — consider discussing both with your doctor or dietitian.";
  }
  const anyOut = confirmedMetrics.some(outOfRange);
  if (anyOut) {
    return "One or more confirmed values appear outside the printed reference range. Consider discussing these results with a healthcare professional.";
  }
  return null;
}

/** Which lab panels are present on a saved report. */
export type ReportPanel = "blood_sugar" | "lipid" | "both" | "none";

export function hasBloodSugar(report: MedicalReportSummary): boolean {
  return report.hba1c != null || report.fasting_glucose != null;
}

export function hasLipidProfile(report: MedicalReportSummary): boolean {
  return (
    report.total_cholesterol != null ||
    report.ldl != null ||
    report.hdl != null ||
    report.triglycerides != null
  );
}

export function reportPanel(report: MedicalReportSummary): ReportPanel {
  const sugar = hasBloodSugar(report);
  const lipid = hasLipidProfile(report);
  if (sugar && lipid) return "both";
  if (sugar) return "blood_sugar";
  if (lipid) return "lipid";
  return "none";
}

export function reportPanelMeta(panel: ReportPanel): {
  label: string;
  short: string;
  tone: "teal" | "blue" | "amber" | "neutral";
} {
  switch (panel) {
    case "blood_sugar":
      return { label: "Blood sugar", short: "Blood sugar", tone: "amber" };
    case "lipid":
      return { label: "Cholesterol", short: "Cholesterol", tone: "blue" };
    case "both":
      return {
        label: "Blood sugar + Cholesterol",
        short: "Both",
        tone: "teal",
      };
    default:
      return { label: "No metrics", short: "Empty", tone: "neutral" };
  }
}
