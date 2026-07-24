"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  CalendarIcon,
  CameraIcon,
  ChartIcon,
  HomeIcon,
  UserIcon,
} from "@/components/icons";

/**
 * Mobile bottom navigation with a raised centre Scan button.
 * Scan sits in the middle as the primary action; the other four flank it.
 */
const left = [
  { href: "/today", label: "Today", icon: HomeIcon },
  { href: "/history", label: "History", icon: CalendarIcon },
];
const right = [
  { href: "/insights", label: "Insights", icon: ChartIcon },
  { href: "/profile", label: "Profile", icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white px-0 pb-3.5 pt-2 md:hidden">
      {left.map((item) => (
        <NavButton
          key={item.href}
          {...item}
          active={pathname.startsWith(item.href)}
        />
      ))}

      <div className="flex justify-center">
        <Link
          href="/scan"
          aria-label="Scan"
          className="-mt-6 inline-flex h-[52px] w-[52px] items-center justify-center rounded-[18px] bg-teal text-white shadow-float"
        >
          <CameraIcon size={26} />
        </Link>
      </div>

      {right.map((item) => (
        <NavButton
          key={item.href}
          {...item}
          active={pathname.startsWith(item.href)}
        />
      ))}
    </nav>
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
