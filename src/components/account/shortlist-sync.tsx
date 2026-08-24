'use client'

import { useEffect, useRef } from 'react'
import { mergeShortlistAction } from '@/server/actions/account'
import { useShortlist } from '@/components/catalog/shortlist'

/**
 * Merges the browser's anonymous shortlist into the account, once.
 *
 * A visitor can collect products before signing up; this is what stops that
 * work disappearing at the login wall. Runs on first mount of the account
 * area, records that it ran in `localStorage`, and never runs again for that
 * browser unless the flag is cleared.
 *
 * Renders nothing.
 */

const MERGED_FLAG = 'sourcely.shortlist.merged.v1'

export function ShortlistSync() {
  const { saved, ready } = useShortlist()
  const attempted = useRef(false)

  useEffect(() => {
    if (!ready || attempted.current) return
    attempted.current = true

    let alreadyMerged = false
    try {
      alreadyMerged = window.localStorage.getItem(MERGED_FLAG) === '1'
    } catch {
      // Storage blocked: skip rather than merge on every page load.
      alreadyMerged = true
    }

    if (alreadyMerged || saved.length === 0) return

    void mergeShortlistAction(saved)
      .then(() => {
        try {
          window.localStorage.setItem(MERGED_FLAG, '1')
        } catch {
          // Nothing to do — worst case it merges again, which is idempotent.
        }
      })
      .catch(() => {
        // A failed merge must not break the page. The local shortlist is
        // still intact and the next visit will retry.
        attempted.current = false
      })
  }, [ready, saved])

  return null
}
