"use client";

import { Badge, Card } from "@/components/ui";

const users = [
  { name: "Maya Kessler", email: "maya@example.com", plan: "premium" as const, status: "active" },
  { name: "Alex Rivera", email: "alex@example.com", plan: "free" as const, status: "active" },
  { name: "Sam Chen", email: "sam@example.com", plan: "premium" as const, status: "active" },
  { name: "spam-bot", email: "spam-bot@test.com", plan: "free" as const, status: "suspended" },
];

export default function AdminUsersPage() {
  return (
    <div>
      <h1 className="mb-5 text-[22px] font-extrabold tracking-tight text-ink">
        User Management
      </h1>

      <Card className="overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line bg-app-bg text-left text-[11px] font-bold tracking-wide text-ink-3">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Plan</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-semibold text-ink">{u.name}</td>
                <td className="px-5 py-3 font-medium text-ink-2">{u.email}</td>
                <td className="px-5 py-3">
                  <Badge tone={u.plan === "premium" ? "amber" : "neutral"}>
                    {u.plan}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={u.status === "active" ? "teal" : "red"}>
                    {u.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
