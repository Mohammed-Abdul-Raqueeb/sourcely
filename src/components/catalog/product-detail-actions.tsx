'use client'

import { Bookmark, Columns3, FileText, MessageSquare } from 'lucide-react'
import { Button, ButtonLink } from '@/components/ui/button'
import { MAX_COMPARE, useShortlist } from './shortlist'

/**
 * Product page actions.
 *
 * "Request quotation" is the primary action and the only amber button on the
 * page — this is an RFQ platform, and the whole layout should funnel to it.
 * Save and compare are secondary; contacting the seller is tertiary, because
 * a quotation request reaches them anyway with the specification attached.
 */
export function ProductDetailActions({
  productId,
  productName,
  sellerName,
}: {
  productId: string
  productName: string
  sellerName: string
}) {
  const { isSaved, isComparing, toggleSaved, toggleCompare, compare, ready } = useShortlist()

  const saved = ready && isSaved(productId)
  const comparing = ready && isComparing(productId)
  const compareFull = ready && compare.length >= MAX_COMPARE && !comparing

  return (
    <div className="space-y-2.5">
      <ButtonLink
        href={`/account/rfq/new?product=${encodeURIComponent(productId)}`}
        size="lg"
        fullWidth
        leadingIcon={<FileText className="size-4" aria-hidden />}
      >
        Request quotation
      </ButtonLink>

      <div className="grid grid-cols-2 gap-2.5">
        <Button
          variant="secondary"
          onClick={() => toggleSaved(productId)}
          aria-pressed={saved}
          leadingIcon={
            <Bookmark className={saved ? 'size-4 fill-current' : 'size-4'} aria-hidden />
          }
        >
          {saved ? 'Saved' : 'Save'}
        </Button>

        <Button
          variant="secondary"
          onClick={() => toggleCompare(productId)}
          aria-pressed={comparing}
          disabled={compareFull}
          title={compareFull ? `Comparison full (${MAX_COMPARE} maximum)` : undefined}
          leadingIcon={<Columns3 className="size-4" aria-hidden />}
        >
          {comparing ? 'Comparing' : 'Compare'}
        </Button>
      </div>

      <ButtonLink
        href={`/contact?product=${encodeURIComponent(productName)}`}
        variant="ghost"
        fullWidth
        size="sm"
        leadingIcon={<MessageSquare className="size-4" aria-hidden />}
      >
        Contact {sellerName}
      </ButtonLink>
    </div>
  )
}
