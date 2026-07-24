"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { AlertTriangleIcon, CheckIcon } from "@/components/icons";

export interface SavedSummary {
  productName: string;
  addedSugarTotal: number;
  addedSugarTarget: number;
}

export function SavedStep({
  summary,
  onLogAnother,
}: {
  summary: SavedSummary;
  onLogAnother: () => void;
}) {
  const router = useRouter();
  const over = summary.addedSugarTotal - summary.addedSugarTarget;

  return (
    <div className="mx-auto flex min-h-[520px] w-full max-w-[420px] flex-col items-center justify-center px-4 text-center">
      <span className="mb-5 inline-flex h-[76px] w-[76px] items-center justify-center rounded-full bg-teal-t text-teal-d">
        <CheckIcon size={38} />
      </span>
      <h1 className="mb-1.5 text-[22px] font-extrabold tracking-tight text-ink">
        Entry saved
      </h1>
      <p className="mb-5 max-w-[260px] text-[13.5px] font-medium leading-relaxed text-ink-2">
        {summary.productName} added to Today. Your added-sugar total is now{" "}
        {summary.addedSugarTotal} g of {summary.addedSugarTarget} g.
      </p>

      {over > 0 && (
        <div className="mb-4 w-full max-w-[290px] rounded-card bg-card p-4 text-left shadow-card">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangleIcon size={15} className="text-amber-d" />
            <span className="text-[11px] font-bold tracking-wide text-amber-d">
              JUST OVER TARGET
            </span>
          </div>
          <p className="text-[12.5px] font-medium leading-relaxed text-ink-2">
            You&rsquo;re {over} g over your added-sugar target today. Return to your
            usual target tomorrow — maybe an unsweetened option next time.
          </p>
        </div>
      )}

      <div className="flex w-full max-w-[290px] flex-col gap-2.5">
        <Button variant="navy" size="lg" fullWidth onClick={() => router.push("/today")}>
          Back to Today
        </Button>
        <Button variant="outline" size="lg" fullWidth onClick={onLogAnother}>
          Log another
        </Button>
      </div>
    </div>
  );
}
