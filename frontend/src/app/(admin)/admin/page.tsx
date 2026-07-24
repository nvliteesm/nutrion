"use client";

import { Card } from "@/components/ui";

const stats = [
  { label: "Total users", value: "1,247" },
  { label: "Premium subscribers", value: "312" },
  { label: "Entries today", value: "4,892" },
  { label: "Medical reports processed", value: "58" },
];

const recentEvents = [
  { time: "14:32", event: "OCR failure", detail: "Blurry nutrition label — user re-uploaded" },
  { time: "13:58", event: "AI safety flag", detail: "Assistant response contained borderline causal language — auto-blocked" },
  { time: "12:41", event: "New Premium", detail: "alex@example.com upgraded to Premium" },
  { time: "11:15", event: "Account suspended", detail: "spam-bot@test.com — automated detection" },
  { time: "09:30", event: "Report processed", detail: "labs_jul22.pdf for user u_maya — 4 metrics extracted" },
];

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="mb-5 text-[22px] font-extrabold tracking-tight text-ink">
        Admin Dashboard
      </h1>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-[24px] font-extrabold text-ink">{s.value}</div>
            <div className="text-[12px] font-semibold text-ink-3">{s.label}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="mb-3 text-[14px] font-bold text-ink">Recent events</div>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-[11px] font-bold tracking-wide text-ink-3">
              <th className="pb-2 pr-3">Time</th>
              <th className="pb-2 pr-3">Event</th>
              <th className="pb-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {recentEvents.map((e, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="py-2.5 pr-3 font-medium text-ink-3">{e.time}</td>
                <td className="py-2.5 pr-3 font-semibold text-ink">{e.event}</td>
                <td className="py-2.5 font-medium text-ink-2">{e.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 rounded-card bg-amber-t px-4 py-3 text-[11.5px] font-medium text-amber-d">
        Sensitive access is logged. Administrators must not casually browse private
        medical data. Access is restricted and auditable.
      </div>
    </div>
  );
}
