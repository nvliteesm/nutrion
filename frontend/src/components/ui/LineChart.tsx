"use client";

import { useId } from "react";

export interface ChartPoint {
  label: string;
  value: number;
}

/**
 * Lightweight dependency-free line/area chart.
 * Renders an SVG with a gradient area fill, the line, dots, and an optional
 * target reference line. Uses currentColor via the `colorClass` text color.
 */
export function LineChart({
  data,
  height = 160,
  colorClass = "text-teal",
  target,
  unit = "",
}: {
  data: ChartPoint[];
  height?: number;
  colorClass?: string;
  target?: number;
  unit?: string;
}) {
  const gradientId = useId();
  const width = 100; // viewBox units; scales to container
  const pad = 6;

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-[12px] font-medium text-ink-3">
        No data for this period.
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const maxV = Math.max(...values, target ?? 0, 1);
  const minV = 0;

  const x = (i: number) =>
    data.length === 1 ? width / 2 : pad + (i / (data.length - 1)) * (width - pad * 2);
  const y = (v: number) => {
    const t = (v - minV) / (maxV - minV || 1);
    return height - pad - t * (height - pad * 2);
  };

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(d.value).toFixed(2)}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${x(data.length - 1).toFixed(2)} ${height - pad} ` +
    `L ${x(0).toFixed(2)} ${height - pad} Z`;

  const peak = Math.max(...values);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;

  return (
    <div className={colorClass}>
      <div className="mb-2 flex items-center gap-4 text-[11px] font-semibold text-ink-3">
        <span>
          Avg{" "}
          <span className="text-ink">
            {Math.round(avg)}
            {unit}
          </span>
        </span>
        <span>
          Peak{" "}
          <span className="text-ink">
            {Math.round(peak)}
            {unit}
          </span>
        </span>
        {target !== undefined && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-2 border-dashed border-ink-3" />
            Target {target}
            {unit}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {target !== undefined && target <= maxV && (
          <line
            x1={pad}
            x2={width - pad}
            y1={y(target)}
            y2={y(target)}
            className="text-ink-3"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="2 2"
          />
        )}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(d.value)}
            r="1.4"
            fill="currentColor"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div className="mt-1.5 flex justify-between text-[9.5px] font-medium text-ink-3">
        <span>{data[0]?.label}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.label}</span>}
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
