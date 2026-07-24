function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-card-lg bg-ink/[0.06] ${className}`} />;
}

/** Loading placeholder that mirrors the dashboard layout. */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Block className="h-6 w-52" />
          <Block className="h-3 w-40" />
        </div>
        <Block className="h-9 w-24 rounded-[11px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-5">
        <Block className="h-[280px]" />
        <Block className="h-[280px]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Block className="h-20" />
        <Block className="h-20" />
        <Block className="h-20" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-5">
        <Block className="h-80" />
        <Block className="h-64" />
      </div>
    </div>
  );
}
