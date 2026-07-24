import type { DailyTotals, NutritionTargets } from "./types";

/**
 * A single supportive daily insight for the dashboard.
 *
 * Product rules honoured here:
 *  - never guilt-based; over-target messaging is gentle and forward-looking
 *  - never reduces or threatens a future target
 */
export function dailyInsight(
  totals: DailyTotals,
  targets: NutritionTargets,
): string {
  if (totals.entryCount === 0) {
    return "No entries yet today. Scan a drink label or log a meal to see your progress.";
  }

  const sugarLeft = targets.addedSugar_g - totals.addedSugar_g;

  if (sugarLeft > 0) {
    return `You've ${sugarLeft} g of added-sugar headroom left — an unsweetened drink this afternoon keeps you comfortably within target.`;
  }

  const over = Math.abs(sugarLeft);
  return `You're ${over} g over your added-sugar target today. Return to your usual target tomorrow, and maybe pick an unsweetened option next time.`;
}
