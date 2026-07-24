import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "strokeWidth"> & {
  size?: number;
};

/** Outline icon wrapper (stroke uses currentColor). */
function Stroke({
  size = 20,
  strokeWidth = 2,
  children,
  ...props
}: IconProps & { strokeWidth?: number; children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Filled icon wrapper (fill uses currentColor). */
function Fill({ size = 20, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const LeafIcon = (p: IconProps) => (
  <Stroke strokeWidth={2.4} {...p}>
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </Stroke>
);

export const HomeIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </Stroke>
);

export const CameraIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </Stroke>
);

export const CalendarIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18M8 2v4M16 2v4" />
  </Stroke>
);

export const ChartIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
    <path d="m19 9-5 5-4-4-3 3" />
  </Stroke>
);

export const UserIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
  </Stroke>
);

export const CupIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M8 2h8M9 2v3.5a5 5 0 0 1-1 3L6.5 11A4 4 0 0 0 6 13v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6a4 4 0 0 0-.5-2l-1.5-2.5a5 5 0 0 1-1-3V2" />
  </Stroke>
);

export const UtensilsIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </Stroke>
);

export const DropletIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 2s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
  </Stroke>
);

export const DropletFilledIcon = (p: IconProps) => (
  <Fill {...p}>
    <path d="M12 2s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
  </Fill>
);

export const PlusIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 5v14M5 12h14" />
  </Stroke>
);

export const FlameIcon = (p: IconProps) => (
  <Fill {...p}>
    <path d="M12 2c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1 .3-1.8.7-2.5C7 8 6 9.7 6 12a6 6 0 0 0 12 0c0-4.5-3.5-7.5-6-10Z" />
  </Fill>
);

export const SparkleIcon = (p: IconProps) => (
  <Fill {...p}>
    <path d="M11.5 2 9 9H4l4 4-1.5 7L12 16l5.5 4L16 13l4-4h-5z" />
  </Fill>
);

export const BulbIcon = (p: IconProps) => (
  <Stroke strokeWidth={2.2} {...p}>
    <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z" />
  </Stroke>
);

export const CheckIcon = (p: IconProps) => (
  <Stroke strokeWidth={3} {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Stroke>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="m9 18 6-6-6-6" />
  </Stroke>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="m15 18-6-6 6-6" />
  </Stroke>
);

export const LockIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect width="18" height="11" x="3" y="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Stroke>
);

export const ImageIcon = (p: IconProps) => (
  <Stroke {...p}>
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
  </Stroke>
);

export const SendIcon = (p: IconProps) => (
  <Stroke strokeWidth={2.2} {...p}>
    <path d="m22 2-7 20-4-9-9-4Z" />
  </Stroke>
);

export const InfoIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </Stroke>
);

export const AlertTriangleIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
    <path d="M12 9v4M12 17h.01" />
  </Stroke>
);

export const SearchIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </Stroke>
);

export const ClockIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Stroke>
);

export const DownloadIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5M12 15V3" />
  </Stroke>
);

export const BellIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </Stroke>
);

export const ChatIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    <path d="M8 12h.01M12 12h.01M16 12h.01" />
  </Stroke>
);

export const ExpandIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
  </Stroke>
);

export const SunIcon = (p: IconProps) => (
  <Stroke {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4" />
  </Stroke>
);

export const MoonIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </Stroke>
);

export const FileTextIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M9 15h6M9 18h4" />
  </Stroke>
);

export const XIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Stroke>
);

export const PencilIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Stroke>
);

export const TrashIcon = (p: IconProps) => (
  <Stroke {...p}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M10 11v6M14 11v6" />
  </Stroke>
);
