'use client'

import { useTransition } from 'react'
import { PAGE_CAP, PAGE_SIZE } from '@/lib/pagination'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { pluralize } from '@/lib/format'

/**
 * Progressive disclosure of a result set.
 *
 * Grows the requested page size rather than paging with a cursor. For a
 * catalogue of this size that is the better trade: the URL stays shareable and
 * shows the same results to whoever opens it, and the back button returns to
 * the same scroll depth.
 *
 * The page sizes live in `src/lib/pagination.ts` rather than here, because a
 * Server Component reads them too — see the note in that file.
 */

export function LoadMore({
  showing,
  total,
}: {
  showing: number
  total: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const remaining = total - showing
  if (remaining <= 0) return null

  const atCap = showing >= PAGE_CAP

  function loadMore() {
    const next = new URLSearchParams(searchParams.toString())
    next.set('show', String(Math.min(PAGE_CAP, showing + PAGE_SIZE)))
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false })
    })
  }

  if (atCap) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="text-sm text-muted">
          Showing the first {showing} of {total}.
        </p>
        <p className="max-w-sm text-[13px] text-faint">
          Add a filter or describe what you need to the assistant — it will rank
          the whole catalogue rather than the first page of it.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <Button variant="secondary" size="md" onClick={loadMore} loading={pending}>
        Load {Math.min(PAGE_SIZE, remaining)} more
      </Button>
      <p className="font-mono text-[11px] text-faint tnum">
        {showing} of {pluralize(total, 'product')}
      </p>
    </div>
  )
}
