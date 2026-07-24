"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  CalendarIcon,
  CameraIcon,
  ChartIcon,
  HomeIcon,
  UserIcon,
} from "@/components/icons";
import { ProfileSheet } from "./ProfileSheet";
import { LogEntrySheet } from "./LogEntrySheet";

/**
 * Mobile bottom navigation with a raised centre Scan button.
 * Scan opens the log-entry sheet; Profile opens the profile sheet.
 */
const left = [
  { href: "/today", label: "Today", icon: HomeIcon },
  { href: "/history", label: "History", icon: CalendarIcon },
];
const right = [{ href: "/insights", label: "Insights", icon: ChartIcon }];

export function BottomNav() {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-card px-0 pb-3.5 pt-2 md:hidden">
        {left.map((item) => (
          <NavButton
            key={item.href}
            {...item}
            active={pathname.startsWith(item.href)}
          />
        ))}

        <div className="flex justify-center">
          <button
            type="button"
            aria-label="Log with camera"
            onClick={() => setLogOpen(true)}
            className="-mt-6 inline-flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-teal text-white shadow-float"
          >
            <CameraIcon size={26} />
          </button>
        </div>

        {right.map((item) => (
          <NavButton
            key={item.href}
            {...item}
            active={pathname.startsWith(item.href)}
          />
        ))}

        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className={cn(
            "flex flex-col items-center gap-1",
            profileOpen ? "text-teal-d" : "text-ink-3",
          )}
        >
          <UserIcon size={21} />
          <span
            className={cn(
              "text-[9.5px]",
              profileOpen ? "font-bold" : "font-semibold",
            )}
          >
            Profile
          </span>
        </button>
      </nav>

      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      <LogEntrySheet open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}

function NavButton({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof HomeIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center gap-1",
        active ? "text-teal-d" : "text-ink-3",
      )}
    >
      <Icon size={21} />
      <span className={cn("text-[9.5px]", active ? "font-bold" : "font-semibold")}>
        {label}
      </span>
    </Link>
  );
}
