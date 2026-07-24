"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/layout/Logo";
import {
  ChartIcon,
  FileTextIcon,
  HomeIcon,
  SearchIcon,
  UserIcon,
} from "@/components/icons";

const nav = [
  { href: "/admin", label: "Dashboard", icon: HomeIcon },
  { href: "/admin/users", label: "Users", icon: UserIcon },
  { href: "/admin/reports", label: "Report Queue", icon: FileTextIcon },
  { href: "/admin/safety", label: "AI Safety", icon: SearchIcon },
  { href: "/admin/analytics", label: "Usage", icon: ChartIcon },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-line bg-card md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5 text-ink">
          <Logo />
        </div>
        <span className="mb-2 px-5 text-[10px] font-bold tracking-widest text-ink-3">
          ADMIN
        </span>
        <nav className="flex flex-col gap-0.5 px-3">
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-semibold transition-colors",
                  active
                    ? "bg-navy text-white"
                    : "text-ink-2 hover:bg-app-bg",
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-line px-5 py-4">
          <Link
            href="/today"
            className="text-[12px] font-semibold text-ink-3 hover:text-ink"
          >
            ← Back to app
          </Link>
        </div>
      </aside>

      <main className="flex-1 bg-app-bg px-6 py-6 md:px-8 md:py-8">
        {children}
      </main>
    </div>
  );
}
