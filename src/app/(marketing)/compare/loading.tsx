import { Skeleton } from '@/components/ui/skeleton'

/** Loading state for the comparison table — header, then wide spec rows. */
export default function CompareLoading() {
  return (
    <div className="container-page py-8 lg:py-12" role="status" aria-label="Loading comparison">
      <div className="mb-8 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <div className="min-w-[40rem] p-6">
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
            ))}
          </div>
          <div className="mt-6 space-y-4">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }, (_, j) => (
                  <Skeleton key={j} className="h-4 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
