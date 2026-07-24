"use client";

import { Badge, Card } from "@/components/ui";

const incidents = [
  {
    time: "Jul 24, 13:58",
    type: "Causal claim detected",
    response: "Auto-blocked",
    detail: "Assistant attempted: \"Your sugar intake caused…\" — rephrased to observational language.",
  },
  {
    time: "Jul 22, 09:12",
    type: "Medical advice detected",
    response: "Auto-blocked",
    detail: "Assistant attempted dosage suggestion — replaced with \"discuss with a healthcare professional.\"",
  },
  {
    time: "Jul 20, 16:40",
    type: "Guilt language detected",
    response: "Reworded",
    detail: "\"You failed your target\" reworded to supportive guidance per product rules.",
  },
];

export default function AdminSafetyPage() {
  return (
    <div>
      <h1 className="mb-5 text-[22px] font-extrabold tracking-tight text-ink">
        AI Safety Review
      </h1>

      <div className="flex flex-col gap-3">
        {incidents.map((inc, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-bold text-ink">{inc.type}</span>
              <Badge tone={inc.response === "Auto-blocked" ? "red" : "amber"}>
                {inc.response}
              </Badge>
            </div>
            <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-ink-2">
              {inc.detail}
            </p>
            <span className="mt-1 text-[10.5px] font-medium text-ink-3">
              {inc.time}
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}
