"use client";

import { useId, useMemo } from "react";

export interface ChartPoint {
  label: string;
  value: number;
}

/**
 * Proper responsive line/area chart with Y-axis, grid, and readable labels.
 */
export function LineChart({
  data,
  height = 220,
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
  const gradientId = useId().replace(/:/g, "");
  const gridId = useId().replace(/:/g, "");

  // Landscape viewBox — keeps stroke/dots proportional when stretched.
  const vbW = 640;
  const vbH = Math.max(height, 180);
  const padL = 44;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = vbW - padL - padR;
  const plotH = vbH - padT - padB;

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const values = data.map((d) => d.value);
    const peak = Math.max(...values);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const rawMax = Math.max(...values, target ?? 0, 1);
    // Nice round Y ceiling so ticks aren't awkward decimals.
    const maxV = niceCeil(rawMax);
    return { values, peak, avg, maxV };
  }, [data, target]);

  if (data.length === 0 || !stats) {
    return (
      <div className="flex h-52 items-center justify-center text-[12px] font-medium text-ink-3">
        No data for this period.
      </div>
    );
  }

  const { peak, avg, maxV } = stats;
  const minV = 0;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minV + t * (maxV - minV));

  const x = (i: number) =>
    data.length === 1
      ? padL + plotW / 2
      : padL + (i / (data.length - 1)) * plotW;

  const y = (v: number) => {
    const t = (v - minV) / (maxV - minV || 1);
    return padT + plotH - t * plotH;
  };

  // Smooth-ish monotone curve via Catmull-Rom → cubic Bezier.
  const linePath = buildSmoothPath(data.map((d, i) => [x(i), y(d.value)]));
  const areaPath =
    `${linePath} L ${x(data.length - 1).toFixed(2)} ${padT + plotH} ` +
    `L ${x(0).toFixed(2)} ${padT + plotH} Z`;

  // Sparse x labels so 30/90-day series stay readable.
  const xLabelIndexes = pickLabelIndexes(data.length);

  // Hide some dots when dense (30/90) — keep endpoints + peaks.
  const showDot = (i: number) => {
    if (data.length <= 14) return true;
    if (i === 0 || i === data.length - 1) return true;
    if (data.length <= 31) return i % 2 === 0;
    return i % Math.ceil(data.length / 12) === 0;
  };

  return (
    <div className={colorClass}>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] font-semibold text-ink-3">
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
            <span className="inline-block h-0 w-5 border-t-2 border-dashed border-ink-3" />
            Target {target}
            {unit}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full"
        style={{ height, minHeight: height }}
        role="img"
        aria-label={`Line chart of values in ${unit || "units"}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
          <pattern
            id={gridId}
            width={plotW}
            height={plotH / 4}
            patternUnits="userSpaceOnUse"
            x={padL}
            y={padT}
          >
            <line
              x1="0"
              x2={plotW}
              y1={plotH / 4}
              y2={plotH / 4}
              stroke="currentColor"
              strokeOpacity="0.08"
              strokeWidth="1"
              className="text-ink"
            />
          </pattern>
        </defs>

        {/* Plot background */}
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          fill={`url(#${gridId})`}
          className="text-ink"
        />
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="1"
          className="text-ink"
          rx="4"
        />

        {/* Y-axis labels + grid */}
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={padL}
              x2={padL + plotW}
              y1={y(tick)}
              y2={y(tick)}
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeWidth="1"
              className="text-ink"
            />
            <text
              x={padL - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-ink-3"
              style={{ fontSize: 11, fontWeight: 600 }}
            >
              {formatTick(tick)}
              {unit && tick === maxV ? unit : ""}
            </text>
          </g>
        ))}

        {target !== undefined && target <= maxV && (
          <line
            x1={padL}
            x2={padL + plotW}
            y1={y(target)}
            y2={y(target)}
            className="text-ink-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="6 5"
            strokeOpacity="0.7"
          />
        )}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {data.map((d, i) =>
          showDot(i) ? (
            <g key={i}>
              <circle
                cx={x(i)}
                cy={y(d.value)}
                r="5"
                fill="white"
                stroke="currentColor"
                strokeWidth="2.25"
              />
            </g>
          ) : null,
        )}

        {/* X-axis labels */}
        {xLabelIndexes.map((i) => (
          <text
            key={`x-${i}`}
            x={x(i)}
            y={vbH - 8}
            textAnchor={
              i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"
            }
            className="fill-ink-3"
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            {data[i]?.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const f = n / 10 ** exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * 10 ** exp;
}

function formatTick(v: number): string {
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1);
}

function pickLabelIndexes(n: number): number[] {
  if (n <= 1) return [0];
  if (n <= 8) return Array.from({ length: n }, (_, i) => i);
  const count = n <= 31 ? 5 : 6;
  const idxs = new Set<number>();
  for (let k = 0; k < count; k++) {
    idxs.add(Math.round((k / (count - 1)) * (n - 1)));
  }
  return [...idxs].sort((a, b) => a - b);
}

/** Catmull-Rom spline converted to SVG cubic Bezier path. */
function buildSmoothPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M ${x} ${y}`;
  }
  if (points.length === 2) {
    const [[x0, y0], [x1, y1]] = points;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} L ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }

  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d +=
      ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)},` +
      ` ${cp2x.toFixed(2)} ${cp2y.toFixed(2)},` +
      ` ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}
