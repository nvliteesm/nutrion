import Link from "next/link";
import { Card } from "@/components/ui";
import {
  CupIcon,
  DropletIcon,
  PlusIcon,
  UtensilsIcon,
} from "@/components/icons";

interface Action {
  label: string;
  href: string;
  icon: typeof CupIcon;
  iconBg: string;
  iconColor: string;
}

const actions: Action[] = [
  {
    label: "Scan food",
    href: "/scan/food",
    icon: UtensilsIcon,
    iconBg: "bg-teal-t",
    iconColor: "text-teal-d",
  },
  {
    label: "Scan drink",
    href: "/scan/drink",
    icon: CupIcon,
    iconBg: "bg-blue-t",
    iconColor: "text-blue-d",
  },
  {
    label: "Add manually",
    href: "/scan/manual",
    icon: PlusIcon,
    iconBg: "bg-navy/[0.06]",
    iconColor: "text-navy",
  },
  {
    label: "Add water",
    href: "/scan/manual",
    icon: DropletIcon,
    iconBg: "bg-blue-t",
    iconColor: "text-blue-d",
  },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-4 gap-2.5 md:gap-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.label} href={action.href}>
            <Card className="flex h-full flex-col items-center gap-2 p-3 transition-shadow hover:shadow-card-lg md:flex-row md:gap-3 md:p-4">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-[11px] ${action.iconBg} ${action.iconColor} shrink-0`}
              >
                <Icon size={19} />
              </span>
              <span className="text-center text-[10px] font-bold text-ink-2 md:text-left md:text-[13px] md:text-ink">
                {action.label}
              </span>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
