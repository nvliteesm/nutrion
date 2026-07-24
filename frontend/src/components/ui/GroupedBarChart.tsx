"use client";

export interface GroupedBarSeries {
  key: string;
  label: string;
  /** Tailwind text color class used as SVG fill via currentColor, e.g. "text-amber". */
  colorClass: string;
}

export interface GroupedBarGroup {
  label: string;
  shortLabel?: string;
  /** series.key → percent of daily target (0–∞). */
  values: Record<string, number>;
}

/**
 * Vertical grouped column chart — one cluster per day/week,
 * one bar per series (sodium / salt / water).
 */
export function GroupedBarChart({
  series,
  groups,
  height = 240,
}: {
  series: GroupedBarSeries[];
  groups: GroupedBarGroup[];
  height?: number;
}) {
  if (groups.length === 0 || series.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-[13px] font-medium text-ink-3">
        No daily data for this period.
      </div>
    );
  }

  const rawMax = Math.max(
    100,
    ...groups.flatMap((g) => series.map((s) => g.values[s.key] ?? 0)),
  );
  // Cap visual scale so outliers don't squash everything; still show overflow.
  const scaleMax = Math.min(Math.ceil(rawMax / 25) * 25, Math.max(150, rawMax));

  const barGap = 3;
  const clusterGap = groups.length > 10 ? 10 : 16;
  const barW = groups.length > 10 ? 8 : groups.length > 7 ? 10 : 14;
  const clusterW = series.length * barW + (series.length - 1) * barGap;
  const plotW =
    groups.length * clusterW + (groups.length - 1) * clusterGap + 8;
  const plotH = height;
  const topPad = 18;
  const bottomPad = 28;
  const chartH = plotH - topPad - bottomPad;

  const y = (pct: number) =>
    topPad + chartH - (Math.min(pct, scaleMax) / scaleMax) * chartH;

  const targetY = y(100);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <span
            key={s.key}
            className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-ink-2"
          >
            <span
              className={`inline-block h-2.5 w-2.5 rounded-sm ${s.colorClass.replace("text-", "bg-")}`}
            />
            {s.label}
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-3">
          <span className="inline-block w-4 border-t-2 border-dashed border-ink-3" />
          Daily target (100%)
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${Math.max(plotW, 280)} ${plotH}`}
          className="min-w-full"
          style={{ height: plotH }}
          role="img"
          aria-label="Sodium, salt, and water versus daily targets"
        >
          {/* Grid lines */}
          {[0, 50, 100].map((tick) => {
            if (tick > scaleMax) return null;
            const yy = y(tick);
            return (
              <g key={tick}>
                <line
                  x1={0}
                  x2={plotW}
                  y1={yy}
                  y2={yy}
                  stroke="currentColor"
                  className="text-line"
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={yy - 4}
                  className="fill-ink-3 text-[10px] font-semibold"
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* Target line */}
          {scaleMax >= 100 && (
            <line
              x1={0}
              x2={plotW}
              y1={targetY}
              y2={targetY}
              stroke="currentColor"
              className="text-ink-3"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}

          {groups.map((g, gi) => {
            const x0 = gi * (clusterW + clusterGap) + 4;
            return (
              <g key={`${g.label}-${gi}`}>
                {series.map((s, si) => {
                  const pct = g.values[s.key] ?? 0;
                  const barH = Math.max(
                    2,
                    ((Math.min(pct, scaleMax) / scaleMax) * chartH),
                  );
                  const x = x0 + si * (barW + barGap);
                  const yy = topPad + chartH - barH;
                  return (
                    <g key={s.key} className={s.colorClass}>
                      <rect
                        x={x}
                        y={yy}
                        width={barW}
                        height={barH}
                        rx={3}
                        fill="currentColor"
                      />
                      {pct > 0 && groups.length <= 10 && (
                        <text
                          x={x + barW / 2}
                          y={yy - 4}
                          textAnchor="middle"
                          className="fill-ink-2 text-[8.5px] font-bold"
                        >
                          {Math.round(pct)}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text
                  x={x0 + clusterW / 2}
                  y={plotH - 8}
                  textAnchor="middle"
                  className="fill-ink-3 text-[10px] font-semibold"
                >
                  {g.shortLabel ?? g.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
