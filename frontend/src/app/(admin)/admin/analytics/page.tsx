"use client";

import { Card, ProgressBar } from "@/components/ui";

const metrics = [
  { label: "Daily active users", value: 487, max: 1247, percent: 39 },
  { label: "Label scans today", value: 1234, max: 2000, percent: 62 },
  { label: "Food photo scans today", value: 389, max: 1000, percent: 39 },
  { label: "Manual logs today", value: 2180, max: 3000, percent: 73 },
  { label: "AI assistant queries today", value: 142, max: 500, percent: 28 },
  { label: "OCR success rate (7d)", value: 94, max: 100, percent: 94 },
];

export default function AdminAnalyticsPage() {
  return (
    <div>
      <h1 className="mb-5 text-[22px] font-extrabold tracking-tight text-ink">
        Usage Analytics
      </h1>

      <div className="grid gap-4 md:grid-cols-2">
        {metrics.map((m) => (
          <Card key={m.label} className="p-4">
            <div className="mb-1.5 flex items-center justify-between text-[12px] font-semibold text-ink-2">
              <span>{m.label}</span>
              <span className="text-ink">{m.value}{m.max === 100 ? "%" : ""}</span>
            </div>
            <ProgressBar value={m.value} max={m.max} />
          </Card>
        ))}
      </div>
    </div>
  );
}
