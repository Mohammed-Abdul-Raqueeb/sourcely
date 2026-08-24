import { cn } from '@/lib/cn'

/**
 * Loading placeholders.
 *
 * Every skeleton here mirrors the exact dimensions of the component it stands
 * in for. A skeleton that is not the same size as its content trades a spinner
 * for a layout shift, which is worse.
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded bg-surface-2',
        'bg-[linear-gradient(90deg,transparent_0%,var(--surface-3)_50%,transparent_100%)]',
        'bg-[length:180%_100%] animate-shimmer',
        className
      )}
    />
  )
}

/** Matches ProductCard: 4:3 media, two title lines, spec row, price row. */
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-3 w-20" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/5" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-14" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-label="Loading products"
    >
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

export function FilterSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }, (_, group) => (
        <div key={group} className="space-y-2.5">
          <Skeleton className="h-3.5 w-24" />
          {Array.from({ length: 4 }, (_, row) => (
            <Skeleton key={row} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}
