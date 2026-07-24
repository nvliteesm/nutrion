import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NutriON — Nutrition Tracker",
    short_name: "NutriON",
    description:
      "Scan drink labels, log meals, and track calories, sugar and hydration. Educational insights, not medical advice.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1622",
    theme_color: "#12b886",
    categories: ["health", "lifestyle", "food"],
    icons: [
      {
        src: "/small-icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/small-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
