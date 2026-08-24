'use client'

import Link from 'next/link'
import { Columns3, X } from 'lucide-react'
import { MAX_COMPARE, useShortlist } from './shortlist'

/**
 * Floating comparison tray.
 *
 * Appears only once something is in the comparison set. Persistent chrome that
 * is empty 95% of the time is chrome that gets ignored, so this earns its
 * space by being conditional.
 *
 * It shows a count rather than thumbnails: the client only holds ids, and
 * fetching four products to render a 40px preview is not worth the request.
 * Phase 4 enriches this alongside the comparison page itself.
 */
export function CompareTray() {
  const { compare, clearCompare, ready } = useShortlist()

  if (!ready || compare.length === 0) return null

  const enough = compare.length >= 2

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-6 sm:pb-6"
      role="region"
      aria-label="Product comparison"
    >
      <div className="container-page pointer-events-none flex justify-center px-0">
        <div className="pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-xl border border-border-strong bg-surface/95 p-2.5 pl-4 shadow-float backdrop-blur-xl animate-fade-up">
          <Columns3 className="size-4 shrink-0 text-accent-text" aria-hidden />

          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-text">
              {compare.length} of {MAX_COMPARE} selected
            </p>
            <p className="text-[11px] text-muted">
              {enough ? 'Ready to compare side by side' : 'Add one more to compare'}
            </p>
          </div>

          <button
            type="button"
            onClick={clearCompare}
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Clear comparison"
            title="Clear comparison"
          >
            <X className="size-4" aria-hidden />
          </button>

          {enough ? (
            <Link
              href="/compare"
              className="inline-flex h-9 shrink-0 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Compare
            </Link>
          ) : (
            <span className="inline-flex h-9 shrink-0 cursor-not-allowed items-center rounded-md bg-surface-3 px-4 text-sm font-medium text-faint">
              Compare
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
