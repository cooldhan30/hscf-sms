export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-stone-200 dark:bg-stone-800 ${className}`} />
}

export function SkeletonStatCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
          <Skeleton className="w-5 h-5 mb-3" />
          <Skeleton className="w-12 h-7 mb-2" />
          <Skeleton className="w-20 h-4" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
      <div className="border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/50 px-4 py-3 flex gap-6">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-20" />
        ))}
      </div>
      <div className="divide-y divide-stone-100 dark:divide-stone-800/60">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3 flex gap-6 items-center">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className={`h-4 ${c === 0 ? 'w-28' : 'w-16'}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="p-6 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3 w-full" />
      ))}
    </div>
  )
}

export function SkeletonChart({ height = 280 }: { height?: number }) {
  return (
    <div className="p-6 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900">
      <Skeleton className="h-5 w-1/4 mb-4" />
      <div style={{ height }} className="animate-pulse rounded-lg bg-stone-200 dark:bg-stone-800" />
    </div>
  )
}
