import type { ComponentType, SVGProps } from "react";
import {
  CalendarIcon,
  CameraIcon,
  ChartIcon,
  HomeIcon,
} from "@/components/icons";

type IconType = ComponentType<
  Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number }
>;

export interface NavItem {
  href: string;
  label: string;
  icon: IconType;
  /** Marks a Premium-gated section (shows a PRO badge). */
  pro?: boolean;
}

/** Primary navigation for the desktop side rail (profile lives at the bottom). */
export const navItems: NavItem[] = [
  { href: "/today", label: "Today", icon: HomeIcon },
  { href: "/scan", label: "Scan", icon: CameraIcon },
  { href: "/history", label: "History", icon: CalendarIcon },
  { href: "/insights", label: "Insights", icon: ChartIcon, pro: true },
];
