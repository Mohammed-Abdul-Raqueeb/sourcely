'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useShortlist } from './shortlist'

/**
 * Bridges the browser's comparison tray into the URL.
 *
 * The comparison set lives in `localStorage` so it works signed-out, but a
 * comparison is something people paste into a group chat — so the page itself
 * is driven by `?ids=`. This component runs only when the URL has no ids: it
 * reads the tray and rewrites the URL, after which the page is a normal
 * server-rendered, shareable route.
 *
 * Renders a brief placeholder rather than nothing, because the alternative is
 * a flash of the empty state for anyone who arrived from the tray.
 */
export function CompareHydrate({ hasIds }: { hasIds: boolean }) {
  const { compare, ready } = useShortlist()
  const router = useRouter()
  const redirected = useRef(false)

  useEffect(() => {
    if (hasIds || !ready || redirected.current) return
    if (compare.length === 0) return

    redirected.current = true
    router.replace(`/compare?ids=${compare.join(',')}`)
  }, [hasIds, ready, compare, router])

  // Nothing to restore, or the URL already won.
  if (hasIds || (ready && compare.length === 0)) return null

  return (
    <div className="flex items-center justify-center gap-2.5 py-20 text-sm text-muted">
      <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
      Restoring your comparison…
    </div>
  )
}
