'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Archive, Eye, MoreHorizontal, PenLine, Upload } from 'lucide-react'
import type { Product } from '@/lib/domain/catalog'
import { cn } from '@/lib/cn'
import { setProductStatusAction } from '@/server/actions/admin'

/**
 * Row actions on the product table.
 *
 * Archiving is a status change, never a delete. A product that has been quoted
 * still has to resolve for the RFQ that references it — deleting the row would
 * turn a real quotation into a dangling id.
 */
export function ProductStatusControl({
  productId,
  status,
}: {
  productId: string
  status: Product['status']
}) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  function change(next: Product['status']) {
    setOpen(false)
    startTransition(() => void setProductStatusAction(productId, next))
  }

  return (
    <div className="relative inline-flex items-center gap-1">
      <Link
        href={`/admin/products/${productId}`}
        aria-label="Edit product"
        title="Edit"
        className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <PenLine className="size-3.5" aria-hidden />
      </Link>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="More actions"
        aria-expanded={open}
        disabled={pending}
        className={cn(
          'grid size-8 place-items-center rounded-md text-muted transition-colors',
          'hover:bg-surface-2 hover:text-text disabled:opacity-40',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </button>

      {open && (
        <>
          {/* Click-away. A menu that only closes on re-click strands itself. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="absolute top-9 right-0 z-50 w-48 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-float">
            {status !== 'active' && (
              <button
                type="button"
                onClick={() => change('active')}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
              >
                <Upload className="size-3.5 text-faint" aria-hidden />
                Publish
              </button>
            )}

            {status !== 'draft' && (
              <button
                type="button"
                onClick={() => change('draft')}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
              >
                <Eye className="size-3.5 text-faint" aria-hidden />
                Unpublish to draft
              </button>
            )}

            {status !== 'archived' && (
              <button
                type="button"
                onClick={() => change('archived')}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-text-2 transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <Archive className="size-3.5 text-faint" aria-hidden />
                Archive
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
