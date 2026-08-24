'use client'

import { useState } from 'react'
import type { ProductImage } from '@/lib/domain/catalog'
import { cn } from '@/lib/cn'
import { ProductArtwork, parseArtwork } from './product-artwork'

/**
 * Product image gallery.
 *
 * The four views are labelled by what they show — front, section, detail,
 * scale — rather than numbered, because on a technical drawing the view *is*
 * the information. Thumbnails are real buttons in a tablist so the gallery is
 * navigable by keyboard.
 */

const VIEW_LABELS: Record<string, string> = {
  front: 'Front view',
  section: 'Section',
  detail: 'Detail',
  scale: 'Scale',
}

/**
 * Generated renders carry their view in the alt text ("… — detail view");
 * uploaded photography usually does not, and falls back to a number.
 */
function photoLabel(alt: string, index: number): string {
  const suffix = alt.split('—').pop()?.trim()
  if (suffix && suffix.length <= 24 && suffix !== alt.trim()) {
    return suffix.charAt(0).toUpperCase() + suffix.slice(1)
  }
  return `View ${index + 1}`
}

export function ProductGallery({
  images,
  productName,
}: {
  images: ProductImage[]
  productName: string
}) {
  const [active, setActive] = useState(0)
  const current = images[active] ?? images[0]

  if (!current) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-xl border border-border bg-surface-2 text-sm text-faint">
        No image available
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <figure className="overflow-hidden rounded-xl border border-border bg-surface-2">
        <div className="aspect-[4/3]">
          {parseArtwork(current.url) ? (
            <ProductArtwork url={current.url} label={current.alt || productName} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={current.alt || productName}
              className="size-full object-cover"
            />
          )}
        </div>
      </figure>

      {images.length > 1 && (
        <div role="tablist" aria-label="Product views" className="grid grid-cols-4 gap-2">
          {images.map((image, index) => {
            const descriptor = parseArtwork(image.url)
            const label = descriptor
              ? (VIEW_LABELS[descriptor.view] ?? 'View')
              : photoLabel(image.alt, index)
            const selected = index === active

            return (
              <button
                key={image.url}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-label={label}
                onClick={() => setActive(index)}
                className={cn(
                  'group overflow-hidden rounded-lg border bg-surface-2 transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  selected
                    ? 'border-accent-line ring-1 ring-accent/30'
                    : 'border-border hover:border-border-strong'
                )}
              >
                <div className="aspect-[4/3]">
                  {descriptor ? (
                    <ProductArtwork url={image.url} label={label} showFrame={false} />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image.url} alt="" className="size-full object-cover" />
                  )}
                </div>
                <span
                  className={cn(
                    'block border-t px-1 py-1 text-[10px] font-medium tracking-wide uppercase',
                    selected
                      ? 'border-accent-line bg-accent-soft text-accent-text'
                      : 'border-border text-faint group-hover:text-muted'
                  )}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
