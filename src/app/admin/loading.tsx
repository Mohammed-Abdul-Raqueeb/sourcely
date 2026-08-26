import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading state for every admin console route.
 *
 * One boundary at the segment root covers the dashboard and each console
 * page — products, RFQs, analytics, reports, audit, settings. The admin
 * pages are dynamic by nature (every one re-authorises and reads live data),
 * so this is the difference between "the console is thinking" and "the
 * console is frozen".
 */
export default function AdminLoading() {
  return (
    <div role="status" aria-label="Loading the console">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-6 py-4">
          <Skeleton className="h-5 w-44" />
        </div>
        <div className="space-y-4 p-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="ml-auto h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
