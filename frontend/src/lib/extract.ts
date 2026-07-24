import type { ExtractedDrink } from "./types";

/**
 * Mock OCR/label extraction. Returns the seeded "Sparkling Yerba Mate" label
 * from the mockup after a short delay, so the review screen has realistic
 * values and a low-confidence field to highlight.
 *
 * Replace with a call to Microsoft Foundry Content Understanding later — keep
 * the `ExtractedDrink` return shape.
 */
export function extractDrinkLabel(): Promise<ExtractedDrink> {
  const result: ExtractedDrink = {
    productName: "Sparkling Yerba Mate",
    servingSizeMl: 355,
    servingsPerContainer: 1,
    caloriesPerServing: 60,
    carbs_g: 15,
    totalSugar_g: 14,
    addedSugar_g: 14,
    caffeine_mg: 80,
    confidence: "high",
    lowConfidenceFields: ["addedSugar_g"],
  };
  return new Promise((resolve) => setTimeout(() => resolve(result), 2200));
}
