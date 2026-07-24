import type { ComponentType, SVGProps } from "react";
import {
  ChartIcon,
  ChatIcon,
  FileTextIcon,
  HomeIcon,
  UserIcon,
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
  /** Opens a sheet instead of navigating. */
  sheet?: "profile";
}

/** Primary navigation for the desktop side rail. */
export const navItems: NavItem[] = [
  { href: "/today", label: "Today", icon: HomeIcon },
  { href: "/medical", label: "Medical", icon: FileTextIcon, pro: true },
  { href: "/history", label: "AI Chat", icon: ChatIcon, pro: true },
  { href: "/insights", label: "Insights", icon: ChartIcon, pro: true },
  { href: "/profile", label: "Profile", icon: UserIcon, sheet: "profile" },
];
