"use client";

import { cn } from "@/lib/cn";

/**
 * Animated water droplet (SVG wave track + CSS keyframes).
 * Fill level is driven by `pct` (0–100).
 */
export function WaterWaveDrop({
  pct,
  pouring = false,
  className,
}: {
  pct: number;
  pouring?: boolean;
  className?: string;
}) {
  const level = Math.max(0, Math.min(100, pct));

  return (
    <div
      className={cn(
        "relative mx-auto h-[104px] w-[80px]",
        pouring && "drop-shadow-[0_0_14px_rgba(59,158,240,0.5)]",
        className,
      )}
      aria-hidden
    >
      {/* Soft empty body */}
      <div
        className="absolute inset-0 bg-blue-t"
        style={{
          clipPath: "path('M40 4C40 4 10 40 10 64a30 30 0 0 0 60 0C70 40 40 4 40 4Z')",
        }}
      />

      {/* Water fill + looping wave surface */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          clipPath: "path('M40 4C40 4 10 40 10 64a30 30 0 0 0 60 0C70 40 40 4 40 4Z')",
        }}
      >
        <div
          className="absolute inset-x-0 bottom-0 bg-blue"
          style={{
            height: `${level}%`,
            transition: pouring ? "none" : "height 280ms ease-out",
          }}
        >
          <div
            className={cn(
              "absolute -top-3 left-0 flex h-4 w-[200%]",
              pouring ? "water-wave-track-fast" : "water-wave-track",
            )}
          >
            <WaveStrip />
            <WaveStrip />
          </div>
        </div>
      </div>

      {/* Outline */}
      <svg
        viewBox="0 0 80 104"
        className="pointer-events-none absolute inset-0 h-full w-full"
        fill="none"
      >
        <path
          d="M40 4C40 4 10 40 10 64a30 30 0 0 0 60 0C70 40 40 4 40 4Z"
          className="stroke-blue-d"
          strokeWidth="2.75"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function WaveStrip() {
  return (
    <svg viewBox="0 0 80 16" className="h-full w-1/2 shrink-0" preserveAspectRatio="none">
      <path
        d="M0 10 Q10 2 20 10 T40 10 T60 10 T80 10 V16 H0 Z"
        className="fill-blue-d"
        opacity="0.95"
      />
      <path
        d="M0 12 Q12 5 24 12 T48 12 T72 12 T80 12 V16 H0 Z"
        className="fill-blue"
      />
    </svg>
  );
}
