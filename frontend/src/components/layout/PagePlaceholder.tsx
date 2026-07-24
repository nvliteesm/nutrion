import { Card } from "@/components/ui";

/**
 * Temporary placeholder for sections that arrive in later phases.
 * Keeps navigation testable while Phase 0 lands.
 */
export function PagePlaceholder({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[24px] font-extrabold leading-tight tracking-tight text-ink">
        {title}
      </h1>
      <Card className="p-6">
        <p className="text-sm font-semibold text-ink-2">{description}</p>
        <p className="mt-2 text-xs font-medium text-ink-3">
          Arrives in {phase}.
        </p>
      </Card>
    </div>
  );
}
