import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading state for every buyer dashboard route.
 *
 * One boundary at the segment root covers /account and each child page:
 * navigating between dashboard sections swaps the child segment, and this
 * shell — header line, stat row, two content cards — stands in until the
 * server render lands. Generic on purpose; each page's real layout differs,
 * and a wrong-but-specific skeleton shifts more than a neutral one.
 */
export default function AccountLoading() {
  return (
    <div role="status" aria-label="Loading your dashboard">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-6">
            <Skeleton className="h-5 w-40" />
            <div className="mt-5 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
