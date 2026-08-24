import Link from 'next/link'
import Image from 'next/image'
import { ShieldCheck } from 'lucide-react'
import type { ProductImage, ProductSpec, ProductView } from '@/lib/domain/catalog'
import type { MatchExplanation } from '@/lib/domain/search'
import { cn } from '@/lib/cn'
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_TONE,
  discountPercent,
  formatPrice,
  truncate,
} from '@/lib/format'
import { Badge, SpecPill } from '@/components/ui/badge'
import { MatchBadge } from '@/components/ui/match-score'
import { ProductArtwork, parseArtwork } from './product-artwork'
import { ProductCardActions } from './product-actions'

/* -------------------------------------------------------------------------- */
/* Media                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Renders either a generated technical drawing or a real photograph,
 * depending on the image URL. Seed data ships drawings; a supplier feed with
 * real photography needs no code change.
 */
export function ProductMedia({
  image,
  label,
  className,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  priority = false,
}: {
  image: ProductImage | undefined
  label: string
  className?: string
  sizes?: string
  priority?: boolean
}) {
  if (!image) {
    return (
      <div className={cn('grid place-items-center bg-surface-2 text-faint', className)}>
        <span className="text-xs">No image</span>
      </div>
    )
  }

  if (parseArtwork(image.url)) {
    return (
      <div className={cn('bg-surface-2', className)}>
        <ProductArtwork url={image.url} label={image.alt || label} />
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden bg-surface-2', className)}>
      <Image
        src={image.url}
        alt={image.alt || label}
        fill
        sizes={sizes}
        priority={priority}
        placeholder={image.blurDataUrl ? 'blur' : 'empty'}
        blurDataURL={image.blurDataUrl ?? undefined}
        className="object-cover"
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export interface ProductCardProps {
  product: ProductView
  /** Precomputed on the server — see server/catalog/highlights.ts. */
  highlights: ProductSpec[]
  /** Present only in AI results. Adds the match badge and reason line. */
  explanation?: MatchExplanation
  /** Compact variant for sidebars and the assistant conversation. */
  dense?: boolean
  priority?: boolean
  className?: string
}

export function ProductCard({
  product,
  highlights,
  explanation,
  dense = false,
  priority = false,
  className,
}: ProductCardProps) {
  const discount = discountPercent(product.price, product.listPrice)
  const href = `/products/${product.slug}`

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface',
        'transition-[border-color,transform,box-shadow] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raise',
        'focus-within:border-accent-line',
        className
      )}
    >
      {/* Media ------------------------------------------------------------ */}
      <div className="relative">
        <ProductMedia
          image={product.images[0]}
          label={product.name}
          priority={priority}
          className={cn('w-full', dense ? 'aspect-[16/9]' : 'aspect-[4/3]')}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {explanation && <MatchBadge percent={explanation.matchPercent} showLabel={!dense} />}
            {!explanation && discount != null && (
              // Solid fill: the translucent accent tone becomes illegible
              // when this badge overlays busy photo content.
              <Badge tone="accent" size="sm" className="border-transparent bg-accent text-accent-ink shadow-sm">
                {discount}% off
              </Badge>
            )}
          </div>
          <ProductCardActions productId={product.id} productName={product.name} />
        </div>
      </div>

      {/* Body -------------------------------------------------------------- */}
      <div className={cn('flex flex-1 flex-col', dense ? 'gap-2 p-3.5' : 'gap-2.5 p-4')}>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-medium tracking-wide text-muted uppercase">
            {product.brand.name}
          </span>
          {product.seller.verified && (
            <ShieldCheck className="size-3 text-success" aria-label="Verified seller" />
          )}
          <span className="ml-auto font-mono text-faint tnum">{product.sku}</span>
        </div>

        <h3 className="text-[15px] leading-snug font-semibold text-text">
          <Link href={href} className="before:absolute before:inset-0 hover:text-accent-text">
            {dense ? truncate(product.name, 62) : product.name}
          </Link>
        </h3>

        {!dense && (
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">
            {product.shortDescription}
          </p>
        )}

        {highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {highlights.map((spec) => (
              <SpecPill key={spec.key} value={spec.displayValue} />
            ))}
          </div>
        )}

        {explanation && (
          <p className="border-l-2 border-accent-line pl-2.5 text-[12px] leading-relaxed text-text-2">
            {truncate(explanation.summary, 130)}
          </p>
        )}

        {/* Footer ---------------------------------------------------------- */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[17px] font-semibold text-text tnum">
                {formatPrice(product.price)}
              </span>
              {product.listPrice != null && product.listPrice > product.price && (
                <span className="font-mono text-xs text-faint line-through tnum">
                  {formatPrice(product.listPrice)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-faint">{product.priceUnit} · excl. GST</span>
          </div>

          <Badge tone={AVAILABILITY_TONE[product.availability.state]} dot size="sm">
            {AVAILABILITY_LABELS[product.availability.state]}
          </Badge>
        </div>
      </div>
    </article>
  )
}

/* -------------------------------------------------------------------------- */

/** Single-row variant for search-result lists and the comparison tray. */
export function ProductRow({
  product,
  highlights,
  explanation,
}: {
  product: ProductView
  highlights: ProductSpec[]
  explanation?: MatchExplanation
}) {
  return (
    <article className="group relative flex gap-4 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-border-strong hover:bg-surface-2">
      <ProductMedia
        image={product.images[0]}
        label={product.name}
        className="aspect-[4/3] w-28 shrink-0 rounded-md sm:w-40"
        sizes="160px"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-medium tracking-wide text-muted uppercase">{product.brand.name}</span>
          <span className="font-mono text-faint tnum">{product.sku}</span>
          {explanation && (
            <span className="ml-auto">
              <MatchBadge percent={explanation.matchPercent} showLabel={false} />
            </span>
          )}
        </div>

        <h3 className="text-sm leading-snug font-semibold text-text">
          <Link href={`/products/${product.slug}`} className="before:absolute before:inset-0 hover:text-accent-text">
            {product.name}
          </Link>
        </h3>

        <p className="line-clamp-1 text-[13px] text-muted sm:line-clamp-2">
          {explanation?.summary ?? product.shortDescription}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
          {highlights.slice(0, 3).map((spec) => (
            <SpecPill key={spec.key} value={spec.displayValue} />
          ))}
          <span className="ml-auto font-mono text-[15px] font-semibold text-text tnum">
            {formatPrice(product.price)}
          </span>
        </div>
      </div>
    </article>
  )
}
