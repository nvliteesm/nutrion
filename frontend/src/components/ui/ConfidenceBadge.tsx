import type { Confidence } from "@/lib/types";
import { Badge, type BadgeTone } from "./Badge";
import { CheckIcon } from "@/components/icons";

const config: Record<Confidence, { label: string; tone: BadgeTone }> = {
  high: { label: "High confidence", tone: "teal" },
  medium: { label: "Medium confidence", tone: "amber" },
  low: { label: "Low confidence", tone: "red" },
};

/**
 * Confidence for OCR / AI extracted values. Low confidence is deliberately
 * loud (red) so users know to double-check before confirming.
 */
export function ConfidenceBadge({
  confidence,
  short = false,
}: {
  confidence: Confidence;
  short?: boolean;
}) {
  const { label, tone } = config[confidence];
  return (
    <Badge tone={tone}>
      {confidence === "high" && <CheckIcon size={11} />}
      {short ? confidence.toUpperCase() : label}
    </Badge>
  );
}
