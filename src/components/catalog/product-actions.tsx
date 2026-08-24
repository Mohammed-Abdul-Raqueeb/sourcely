'use client'

import { Bookmark, Columns3, Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { MAX_COMPARE, useShortlist } from './shortlist'

/**
 * Save and compare controls on a product card.
 *
 * A small client island inside an otherwise server-rendered card — the card
 * itself never becomes a client component, so the catalogue grid stays cheap.
 *
 * `pointer-events-auto` is deliberate: the parent card overlay is
 * `pointer-events-none` so the whole card stays one click target, and these
 * two buttons opt back in.
 */
export function ProductCardActions({
  productId,
  productName,
}: {
  productId: string
  productName: string
}) {
  const { isSaved, isComparing, toggleSaved, toggleCompare, compare, ready } = useShortlist()

  const saved = ready && isSaved(productId)
  const comparing = ready && isComparing(productId)
  const compareFull = ready && compare.length >= MAX_COMPARE && !comparing

  return (
    <div className="pointer-events-auto flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => toggleSaved(productId)}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${productName} from shortlist` : `Save ${productName} to shortlist`}
        title={saved ? 'Saved to shortlist' : 'Save to shortlist'}
        className={cn(
          'relative z-1 grid size-8 place-items-center rounded-md border backdrop-blur-sm',
          'transition-[background-color,border-color,color] duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          saved
            ? 'border-accent-line bg-accent-soft text-accent-text'
            : 'border-border bg-surface/85 text-muted hover:border-border-strong hover:text-text'
        )}
      >
        <Bookmark className={cn('size-4', saved && 'fill-current')} aria-hidden />
      </button>

      <button
        type="button"
        onClick={() => toggleCompare(productId)}
        aria-pressed={comparing}
        disabled={compareFull}
        aria-label={
          comparing
            ? `Remove ${productName} from comparison`
            : compareFull
              ? `Comparison is full, maximum ${MAX_COMPARE} products`
              : `Add ${productName} to comparison`
        }
        title={
          comparing ? 'In comparison' : compareFull ? `Comparison full (${MAX_COMPARE} max)` : 'Add to comparison'
        }
        className={cn(
          'relative z-1 grid size-8 place-items-center rounded-md border backdrop-blur-sm',
          'transition-[background-color,border-color,color] duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'disabled:cursor-not-allowed disabled:opacity-40',
          comparing
            ? 'border-accent-line bg-accent-soft text-accent-text'
            : 'border-border bg-surface/85 text-muted hover:border-border-strong hover:text-text'
        )}
      >
        {comparing ? <Check className="size-4" aria-hidden /> : <Columns3 className="size-4" aria-hidden />}
      </button>
    </div>
  )
}
