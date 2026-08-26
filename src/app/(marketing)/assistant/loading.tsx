import { Skeleton, TextSkeleton } from '@/components/ui/skeleton'

/** Loading state for the assistant workspace — prompt panel over result area. */
export default function AssistantLoading() {
  return (
    <div className="container-page py-8 lg:py-12" role="status" aria-label="Loading the assistant">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-72 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-14 w-full rounded-xl" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-40 rounded-full" />
          ))}
        </div>
        <div className="rounded-xl border border-border bg-surface p-6">
          <TextSkeleton lines={4} />
        </div>
      </div>
    </div>
  )
}
