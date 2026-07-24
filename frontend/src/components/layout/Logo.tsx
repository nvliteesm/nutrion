import { cn } from "@/lib/cn";
import { LeafIcon } from "@/components/icons";

export function Logo({
  className,
  markOnly = false,
}: {
  className?: string;
  markOnly?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-teal text-white">
        <LeafIcon size={17} />
      </span>
      {!markOnly && (
        <span className="text-[19px] font-extrabold leading-none tracking-tight">
          NutriON
        </span>
      )}
    </div>
  );
}
