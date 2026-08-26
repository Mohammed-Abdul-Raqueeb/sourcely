import { Skeleton, TextSkeleton } from '@/components/ui/skeleton'

/**
 * Route-level loading state for a product detail page.
 *
 * Reached-from-search detail pages render dynamically (the `?q=` explanation
 * panel), so navigation can otherwise sit on the old page with no feedback.
 * The shell matches the page: breadcrumb, then gallery beside the buy box.
 */
export default function ProductLoading() {
  return (
    <div className="container-page py-8 lg:py-12" role="status" aria-label="Loading product">
      <div className="mb-6">
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <div className="min-w-0 space-y-4">
          <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          <div className="flex gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="size-16 rounded-md" />
            ))}
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <Skeleton className="h-3.5 w-24" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-3/4" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-9 w-40" />
          <TextSkeleton lines={3} />
          <div className="flex gap-2.5 pt-2">
            <Skeleton className="h-11 w-40" />
            <Skeleton className="h-11 w-32" />
          </div>
        </div>
      </div>

      <div className="mt-12 space-y-4">
        <Skeleton className="h-6 w-52" />
        <TextSkeleton lines={4} />
      </div>
    </div>
  )
}
