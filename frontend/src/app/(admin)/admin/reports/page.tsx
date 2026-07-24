"use client";

import { Badge, Card } from "@/components/ui";

const queue = [
  { file: "labs_jul22.pdf", user: "maya@example.com", metrics: 4, status: "completed" },
  { file: "checkup_may.pdf", user: "sam@example.com", metrics: 3, status: "completed" },
  { file: "blood_test.jpg", user: "alex@example.com", metrics: 0, status: "failed" },
];

export default function AdminReportsPage() {
  return (
    <div>
      <h1 className="mb-5 text-[22px] font-extrabold tracking-tight text-ink">
        Report Processing Queue
      </h1>

      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line bg-app-bg text-left text-[11px] font-bold tracking-wide text-ink-3">
              <th className="px-5 py-3">File</th>
              <th className="px-5 py-3">User</th>
              <th className="px-5 py-3">Metrics</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((r, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-semibold text-ink">{r.file}</td>
                <td className="px-5 py-3 font-medium text-ink-2">{r.user}</td>
                <td className="px-5 py-3 font-medium text-ink-2">{r.metrics}</td>
                <td className="px-5 py-3">
                  <Badge tone={r.status === "completed" ? "teal" : "red"}>
                    {r.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 rounded-card bg-amber-t px-4 py-3 text-[11.5px] font-medium text-amber-d">
        Report content (medical data) is not displayed here. Only processing
        metadata is visible to administrators. Access to patient data requires
        elevated permissions and is logged.
      </div>
    </div>
  );
}
