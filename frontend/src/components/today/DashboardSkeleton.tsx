function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card-lg bg-ink/[0.06] ${className}`} />;
}

/** Loading placeholder that mirrors the dashboard layout. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Block className="h-3 w-28" />
          <Block className="h-6 w-52" />
        </div>
        <Block className="h-9 w-24 rounded-[11px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr] md:gap-[18px]">
        <Block className="h-[220px]" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-1 md:gap-[18px]">
          <Block className="h-[110px]" />
          <Block className="h-[110px]" />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5 md:gap-3">
        <Block className="h-16" />
        <Block className="h-16" />
        <Block className="h-16" />
        <Block className="h-16" />
      </div>

      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr] md:gap-[18px]">
        <Block className="h-48" />
        <Block className="h-48" />
      </div>
    </div>
  );
}
