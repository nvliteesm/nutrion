import { Card } from "@/components/ui";
import { Badge } from "@/components/ui";
import { DropletFilledIcon } from "@/components/icons";

export function HydrationCard({
  cups,
  target,
}: {
  cups: number;
  target: number;
}) {
  const toGo = Math.max(target - cups, 0);

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-ink-2 md:text-[13px]">
          Hydration
        </span>
        <div className="hidden md:block">
          <Badge tone="blue">
            <DropletFilledIcon size={11} />
            {toGo > 0 ? "Keep going" : "Goal met"}
          </Badge>
        </div>
      </div>

      <div className="mb-2.5 mt-2 flex items-baseline gap-1.5">
        <span className="text-[22px] font-extrabold leading-none text-ink md:text-[28px]">
          {cups}
        </span>
        <span className="text-[12px] font-semibold text-ink-3 md:text-[13px]">
          / {target} cups
        </span>
      </div>

      <div className="flex gap-1 md:gap-1.5">
        {Array.from({ length: target }).map((_, i) => (
          <span
            key={i}
            className={`h-3.5 flex-1 rounded md:h-5 ${
              i < cups ? "bg-blue" : "bg-line"
            }`}
          />
        ))}
      </div>

      <div className="mt-1.5 text-[10.5px] font-semibold text-blue-d">
        {toGo > 0 ? `${toGo} cups to go` : "Nicely hydrated"}
      </div>
    </Card>
  );
}
