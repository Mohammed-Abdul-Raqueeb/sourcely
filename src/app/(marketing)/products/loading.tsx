import { FilterSkeleton, ProductCardSkeleton, Skeleton } from '@/components/ui/skeleton'

/**
 * Route-level loading state for the catalogue.
 *
 * Mirrors the page's exact shell — breadcrumb, header row, filter rail and
 * card grid share the same container and grid classes — so the real content
 * replaces it without a reflow. Without this file, a click on "Catalogue"
 * leaves the previous page frozen on screen for however long the server
 * render takes, which reads as a hang.
 */
export default function ProductsLoading() {
  return (
    <div className="container-page py-8 lg:py-12">
      <div className="mb-5">
        <Skeleton className="h-4 w-36" />
      </div>

      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-9 w-64 md:h-10" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-56 shrink-0" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <FilterSkeleton />
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-9 w-40" />
          </div>

          <div
            className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
            role="status"
            aria-label="Loading the catalogue"
          >
            {Array.from({ length: 9 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
