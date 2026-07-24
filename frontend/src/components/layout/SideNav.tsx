"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { navItems } from "@/lib/nav";
import { getStoredSession } from "@/lib/auth";
import { useEffect, useState } from "react";
import { SidebarIcon } from "@/components/icons";
import { Logo } from "./Logo";

const SIDEBAR_KEY = "nutrion.sidebar.expanded";

/** Desktop left rail matching the NutriON home mock. */
export function SideNav() {
  const pathname = usePathname();
  const [initials, setInitials] = useState("U");
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setInitials(getStoredSession()?.initials ?? "U");
    const stored = window.localStorage.getItem(SIDEBAR_KEY);
    if (stored === "0") setExpanded(false);
    if (stored === "1") setExpanded(true);
  }, []);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "relative sticky top-0 z-20 hidden h-screen shrink-0 flex-col border-r border-line bg-card py-5 transition-[width] duration-200 ease-out md:flex",
        expanded ? "w-[220px] px-3" : "w-[72px] items-center px-1.5",
      )}
    >
      <div className="mb-8 flex w-full items-center justify-center px-1">
        <Link href="/today" aria-label="NutriON home">
          {expanded ? <Logo /> : <Logo markOnly />}
        </Link>
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col gap-1.5",
          expanded ? "items-stretch" : "items-center",
        )}
      >
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-11 items-center rounded-[14px] transition-colors",
                expanded ? "gap-3 px-3" : "w-11 justify-center",
                active
                  ? "bg-teal text-navy-ink shadow-float"
                  : "text-ink-3 hover:bg-app-bg hover:text-ink",
              )}
            >
              <Icon size={20} className="shrink-0" />
              {expanded && (
                <span className="truncate text-[13.5px] font-semibold">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/profile"
        className={cn(
          "mt-2 inline-flex items-center rounded-full bg-teal/20 text-[12px] font-bold text-teal-d transition-colors hover:bg-teal/30",
          expanded ? "h-10 gap-2.5 px-2.5" : "h-10 w-10 justify-center",
        )}
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal/30">
          {initials}
        </span>
        {expanded && <span>Profile</span>}
      </Link>

      {/* Toggle sits just outside the rail edge */}
      <button
        type="button"
        onClick={toggle}
        aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
        aria-expanded={expanded}
        title={expanded ? "Collapse" : "Expand"}
        className="absolute top-1/2 right-0 z-30 inline-flex h-8 w-8 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-line bg-card text-ink-2 shadow-card transition-colors hover:bg-app-bg hover:text-ink"
      >
        <SidebarIcon size={16} />
      </button>
    </aside>
  );
}
