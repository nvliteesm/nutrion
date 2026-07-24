"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { navItems } from "@/lib/nav";
import { CameraIcon, SidebarIcon } from "@/components/icons";
import { Logo } from "./Logo";
import { LogEntrySheet } from "./LogEntrySheet";
import { ProfileSheet } from "./ProfileSheet";

const SIDEBAR_KEY = "nutrion.sidebar.expanded";

/** Desktop left rail matching the NutriON home mock. */
export function SideNav() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  useEffect(() => {
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
<<<<<<< Updated upstream
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
=======
    <>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-card py-5 transition-[width] duration-200 ease-out md:flex",
          expanded ? "w-[220px] px-3" : "w-[72px] items-center",
        )}
      >
        <div
          className={cn(
            "mb-8 flex w-full items-center",
            expanded ? "justify-between px-1" : "flex-col gap-3",
          )}
        >
          <Link
            href="/today"
            aria-label="NutriON home"
            className={cn(expanded && "px-1")}
          >
            {expanded ? <Logo /> : <Logo markOnly />}
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
            aria-expanded={expanded}
            title={expanded ? "Collapse" : "Expand"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-ink-2 transition-colors hover:bg-app-bg hover:text-ink"
          >
            <SidebarIcon size={20} />
          </button>
        </div>

        <nav
          className={cn(
            "flex flex-1 flex-col gap-1.5",
            expanded ? "items-stretch" : "items-center",
          )}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.sheet
              ? profileOpen
              : pathname.startsWith(item.href);

            if (item.sheet === "profile") {
              return (
                <button
                  key={item.href}
                  type="button"
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setProfileOpen(true)}
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
                </button>
              );
            }

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

        <button
          type="button"
          onClick={() => setLogOpen(true)}
          title="Log with camera"
          className={cn(
            "mt-2 flex items-center border border-line bg-app-bg transition hover:bg-line/60",
            expanded
              ? "h-12 w-full gap-2.5 rounded-[18px] px-2.5"
              : "h-11 w-11 justify-center rounded-[14px]",
          )}
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-navy to-navy-2 text-white shadow-sm">
            <CameraIcon size={15} />
          </span>
          {expanded && (
            <span className="truncate text-[13px] font-bold text-ink">
              Log with camera
            </span>
          )}
        </button>
      </aside>

      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      <LogEntrySheet open={logOpen} onClose={() => setLogOpen(false)} />
    </>
>>>>>>> Stashed changes
  );
}
