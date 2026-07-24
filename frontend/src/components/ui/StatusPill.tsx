import type { DailyStatus } from "@/lib/types";
import { Badge, type BadgeTone } from "./Badge";
import { CheckIcon, DropletFilledIcon } from "@/components/icons";

const config: Record<
  DailyStatus,
  { label: string; tone: BadgeTone; icon?: "check" | "droplet" }
> = {
  within: { label: "Within target", tone: "teal", icon: "check" },
  approaching: { label: "Approaching target", tone: "amber" },
  above: { label: "Above target", tone: "red" },
  incomplete: { label: "Incomplete logging", tone: "blue", icon: "droplet" },
  no_data: { label: "No data yet", tone: "neutral" },
};

export function StatusPill({
  status,
  label,
}: {
  status: DailyStatus;
  /** Override the default label (e.g. a shorter form). */
  label?: string;
}) {
  const { label: defaultLabel, tone, icon } = config[status];
  return (
    <Badge tone={tone}>
      {icon === "check" && <CheckIcon size={11} />}
      {icon === "droplet" && <DropletFilledIcon size={11} />}
      {label ?? defaultLabel}
    </Badge>
  );
}
