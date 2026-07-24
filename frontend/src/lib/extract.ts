import type { ExtractedDrink, FoodAnalysis, Nutrients } from "./types";

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

const perServing = (
  calories: number,
  carbs_g: number,
  totalSugar_g: number,
  addedSugar_g: number,
  protein_g: number,
  fat_g: number,
): Nutrients => ({
  calories,
  carbs_g,
  totalSugar_g,
  addedSugar_g,
  protein_g,
  fat_g,
});

/**
 * Mock food-photo analysis. Returns detected items with per-serving ranges
 * so the review screen can show estimates (never false precision).
 *
 * Replace with a vision model (e.g. GPT-4o / Gemini) later — keep the
 * `FoodAnalysis` return shape.
 */
export function analyzeFoodPhoto(): Promise<FoodAnalysis> {
  const result: FoodAnalysis = {
    confidence: "medium",
    items: [
      {
        id: "rice",
        name: "White rice",
        unit: "cup",
        servings: 1,
        perServingRange: [185, 230],
        perServingNutrients: perServing(207, 45, 0, 0, 4, 0),
      },
      {
        id: "chicken",
        name: "Grilled chicken",
        unit: "120 g",
        servings: 1,
        perServingRange: [200, 250],
        perServingNutrients: perServing(225, 0, 0, 0, 35, 9),
      },
      {
        id: "veg",
        name: "Mixed vegetables",
        unit: "½ cup",
        servings: 1,
        perServingRange: [45, 70],
        perServingNutrients: perServing(57, 10, 4, 0, 2, 1),
      },
    ],
  };
  return new Promise((resolve) => setTimeout(() => resolve(result), 2200));
}
