'use client'

import { useEffect } from 'react'
import { recordViewAction } from '@/server/actions/account'

/**
 * Records a product view after paint.
 *
 * Lives in the client on purpose: the product page is statically prerendered,
 * so nothing in its server render runs when a real visitor opens it — a write
 * there would fire at build time, once, and never again. A post-paint action
 * call runs per real visit and keeps the page itself cacheable.
 *
 * Best-effort by design. Losing an analytics row to a flaky connection is
 * fine; surfacing an error toast for one never is.
 */
export function ViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    void recordViewAction(productId).catch(() => {})
  }, [productId])

  return null
}
