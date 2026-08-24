'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bookmark, ChevronDown, Columns3, ExternalLink } from 'lucide-react'
import type { RankedProduct } from '@/lib/domain/search'
import { cn } from '@/lib/cn'
import { AVAILABILITY_LABELS, AVAILABILITY_TONE, formatPrice } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { MatchRing, CriterionRow } from '@/components/ui/match-score'
import { ProductMedia } from '@/components/catalog/product-card'
import { MAX_COMPARE, useShortlist } from '@/components/catalog/shortlist'

/**
 * A product inside the conversation.
 *
 * Denser than the catalogue card and built around the match score, because
 * here the question is not "what is this" but "why did you show me this".
 * The criteria table is one tap away and shows misses as misses.
 */
export function AssistantResultCard({
  result,
  rank,
  query,
}: {
  result: RankedProduct
  rank: number
  query: string
}) {
  const [open, setOpen] = useState(false)
  const { isSaved, isComparing, toggleSaved, toggleCompare, compare, ready } = useShortlist()

  const { product, explanation } = result
  const saved = ready && isSaved(product.id)
  const comparing = ready && isComparing(product.id)
  const compareFull = ready && compare.length >= MAX_COMPARE && !comparing

  const href = `/products/${product.slug}${query ? `?q=${encodeURIComponent(query)}` : ''}`
  const image = product.images[0]

  return (
    <article
      className={cn(
        'overflow-hidden rounded-xl border bg-surface transition-colors',
        explanation.matchPercent >= 85 ? 'border-accent-line' : 'border-border'
      )}
    >
      <div className="flex gap-3.5 p-3.5">
        {/* Rank + image ---------------------------------------------------- */}
        <div className="hidden w-24 shrink-0 sm:block">
          <div className="overflow-hidden rounded-lg">
            <ProductMedia
              image={image}
              label={product.name}
              className="aspect-[4/3] w-full"
              sizes="96px"
            />
          </div>
          <p className="mt-1.5 text-center font-mono text-[10px] text-faint tnum">#{rank}</p>
        </div>

        {/* Body ------------------------------------------------------------ */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted uppercase">
                {product.brand.name}
                <span className="font-mono text-faint normal-case tnum">{product.sku}</span>
              </p>
              <h3 className="mt-0.5 text-[14px] leading-snug font-semibold text-text">
                <Link href={href} className="hover:text-accent-text">
                  {product.name}
                </Link>
              </h3>
            </div>

            <MatchRing percent={explanation.matchPercent} size={44} strokeWidth={2.5} />
          </div>

          {/* Price + availability ------------------------------------------ */}
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="font-mono text-[16px] font-semibold text-text tnum">
              {formatPrice(product.price)}
            </span>
            <span className="text-[11px] text-faint">{product.priceUnit}</span>
            <Badge tone={AVAILABILITY_TONE[product.availability.state]} size="sm" dot>
              {AVAILABILITY_LABELS[product.availability.state]}
            </Badge>
          </div>

          {/* Reason --------------------------------------------------------- */}
          <p className="mt-2.5 border-l-2 border-accent-line pl-2.5 text-[12.5px] leading-relaxed text-text-2">
            {explanation.summary}
          </p>

          {/* Actions -------------------------------------------------------- */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface-2 px-2.5 text-[12px] font-medium text-text-2 transition-colors hover:border-border-strong hover:text-text"
            >
              <ChevronDown
                className={cn('size-3 transition-transform', open && 'rotate-180')}
                aria-hidden
              />
              {explanation.headline}
            </button>

            <button
              type="button"
              onClick={() => toggleSaved(product.id)}
              aria-pressed={saved}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[12px] font-medium transition-colors',
                saved
                  ? 'border-accent-line bg-accent-soft text-accent-text'
                  : 'border-border bg-surface-2 text-text-2 hover:border-border-strong hover:text-text'
              )}
            >
              <Bookmark className={cn('size-3', saved && 'fill-current')} aria-hidden />
              {saved ? 'Saved' : 'Save'}
            </button>

            <button
              type="button"
              onClick={() => toggleCompare(product.id)}
              aria-pressed={comparing}
              disabled={compareFull}
              title={compareFull ? `Comparison full (${MAX_COMPARE} maximum)` : undefined}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[12px] font-medium transition-colors',
                'disabled:cursor-not-allowed disabled:opacity-40',
                comparing
                  ? 'border-accent-line bg-accent-soft text-accent-text'
                  : 'border-border bg-surface-2 text-text-2 hover:border-border-strong hover:text-text'
              )}
            >
              <Columns3 className="size-3" aria-hidden />
              {comparing ? 'Comparing' : 'Compare'}
            </button>

            <Link
              href={href}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-muted transition-colors hover:text-accent-text"
            >
              Details
              <ExternalLink className="size-3" aria-hidden />
            </Link>
          </div>
        </div>
      </div>

      {/* Criteria table ---------------------------------------------------- */}
      {open && explanation.criteria.length > 0 && (
        <div className="border-t border-border bg-surface-2/50 px-4 py-3">
          <ul className="divide-y divide-border/60">
            {explanation.criteria.map((criterion) => (
              <CriterionRow key={criterion.key} criterion={criterion} />
            ))}
          </ul>
          <p className="mt-2.5 border-t border-border/60 pt-2.5 text-[11px] leading-relaxed text-faint">
            Match score computed from the specification sheet — not generated.
          </p>
        </div>
      )}
    </article>
  )
}
