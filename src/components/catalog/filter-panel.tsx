'use client'

import { useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import type { AvailabilityState } from '@/lib/domain/catalog'
import type { Facet } from '@/lib/domain/search'
import { cn } from '@/lib/cn'
import { formatCompactINR } from '@/lib/format'
import {
  activeFilterCount,
  catalogHref,
  clearFilters,
  hasActiveFilters,
  setPrice,
  setSpecRange,
  toggleAvailability,
  toggleListValue,
  toggleSpecValue,
  type CatalogParams,
} from '@/lib/catalog-params'
import { Button } from '@/components/ui/button'
import { Checkbox, Input } from '@/components/ui/input'

/**
 * Faceted filter panel.
 *
 * Every interaction rewrites the URL and lets the server re-render. There is
 * no client-side filter state to drift out of sync, the back button works,
 * and a filtered view can be pasted into an email.
 *
 * `useTransition` keeps the panel interactive while the server responds, so
 * rapid checkbox clicks queue instead of blocking.
 */

const GROUP_ORDER = ['Catalogue', 'Specification', 'Commercial']

export function FilterPanel({
  facets,
  params,
  total,
}: {
  facets: Facet[]
  params: CatalogParams
  total: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [mobileOpen, setMobileOpen] = useState(false)

  function apply(next: CatalogParams) {
    startTransition(() => {
      router.push(catalogHref(next, pathname), { scroll: false })
    })
  }

  const count = activeFilterCount(params)
  const active = hasActiveFilters(params)

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    facets: facets.filter((facet) => facet.group === group),
  })).filter((entry) => entry.facets.length > 0)

  const body = (
    <div className={cn('space-y-7', pending && 'pointer-events-none opacity-60')}>
      {active && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-accent-line bg-accent-soft px-3 py-2.5">
          <span className="text-[13px] text-text">
            <span className="font-mono font-semibold tnum">{count}</span> filter
            {count === 1 ? '' : 's'} active
          </span>
          <Button variant="ghost" size="xs" onClick={() => apply(clearFilters(params))}>
            Clear all
          </Button>
        </div>
      )}

      {grouped.map(({ group, facets: groupFacets }) => (
        <section key={group}>
          <h3 className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
            {group}
          </h3>
          <div className="space-y-5">
            {groupFacets.map((facet) => (
              <FacetControl key={facet.key} facet={facet} params={params} onApply={apply} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )

  return (
    <>
      {/* Mobile trigger --------------------------------------------------- */}
      <div className="lg:hidden">
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          onClick={() => setMobileOpen(true)}
          leadingIcon={<SlidersHorizontal className="size-4" aria-hidden />}
        >
          Filters{count > 0 && ` (${count})`}
        </Button>
      </div>

      {/* Desktop sidebar -------------------------------------------------- */}
      <aside className="hidden lg:block" aria-label="Product filters">
        {body}
      </aside>

      {/* Mobile drawer ----------------------------------------------------- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-[min(24rem,90vw)] flex-col border-l border-border bg-bg">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-display text-lg font-semibold">Filters</h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close filters"
                className="grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 scrollbar-slim">{body}</div>

            <div className="border-t border-border p-4">
              <Button fullWidth onClick={() => setMobileOpen(false)}>
                Show {total} product{total === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* -------------------------------------------------------------------------- */

function FacetControl({
  facet,
  params,
  onApply,
}: {
  facet: Facet
  params: CatalogParams
  onApply: (next: CatalogParams) => void
}) {
  const [expanded, setExpanded] = useState(false)

  if (facet.kind === 'range') {
    return <RangeFacet facet={facet} params={params} onApply={onApply} />
  }

  const buckets = facet.buckets ?? []
  const limit = facet.collapseAfter ?? buckets.length
  // Selected buckets always render, even past the collapse point — a filter
  // you cannot see is a filter you cannot remove.
  const visible = expanded
    ? buckets
    : [...buckets.filter((bucket) => bucket.selected), ...buckets.filter((bucket) => !bucket.selected)].slice(
        0,
        limit
      )

  function onToggle(value: string) {
    if (facet.key === 'category') return onApply(toggleListValue(params, 'categoryKeys', value))
    if (facet.key === 'brand') return onApply(toggleListValue(params, 'brandKeys', value))
    if (facet.key === 'availability')
      return onApply(toggleAvailability(params, value as AvailabilityState))
    return onApply(toggleSpecValue(params, facet.key, value))
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-medium text-text-2">{facet.label}</legend>
      <div className="space-y-0.5">
        {visible.map((bucket) => (
          <Checkbox
            key={bucket.value}
            label={bucket.label}
            count={bucket.count}
            checked={bucket.selected}
            onChange={() => onToggle(bucket.value)}
            disabled={bucket.count === 0 && !bucket.selected}
          />
        ))}
      </div>

      {buckets.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-accent-text hover:underline"
        >
          <ChevronDown
            className={cn('size-3.5 transition-transform', expanded && 'rotate-180')}
            aria-hidden
          />
          {expanded ? 'Show fewer' : `Show all ${buckets.length}`}
        </button>
      )}
    </fieldset>
  )
}

/* -------------------------------------------------------------------------- */

function RangeFacet({
  facet,
  params,
  onApply,
}: {
  facet: Facet
  params: CatalogParams
  onApply: (next: CatalogParams) => void
}) {
  const range = facet.range
  const isPrice = facet.key === 'price'

  const [min, setMin] = useState(range?.selectedMin?.toString() ?? '')
  const [max, setMax] = useState(range?.selectedMax?.toString() ?? '')

  if (!range) return null

  function commit() {
    const parsedMin = min.trim() === '' ? null : Number.parseInt(min, 10)
    const parsedMax = max.trim() === '' ? null : Number.parseInt(max, 10)
    const safeMin = parsedMin != null && Number.isFinite(parsedMin) ? parsedMin : null
    const safeMax = parsedMax != null && Number.isFinite(parsedMax) ? parsedMax : null

    onApply(
      isPrice
        ? setPrice(params, safeMin, safeMax)
        : setSpecRange(params, facet.key, safeMin, safeMax)
    )
  }

  const hint = isPrice
    ? `${formatCompactINR(range.min)} – ${formatCompactINR(range.max)}`
    : `${range.min} – ${range.max}${range.unit ? ` ${range.unit}` : ''}`

  return (
    <fieldset>
      <legend className="mb-1.5 flex w-full items-baseline justify-between gap-2 text-[13px] font-medium text-text-2">
        {facet.label}
        <span className="font-mono text-[11px] font-normal text-faint tnum">{hint}</span>
      </legend>

      <div className="flex items-center gap-2">
        <Input
          inputSize="sm"
          type="number"
          inputMode="numeric"
          placeholder="Min"
          aria-label={`Minimum ${facet.label}`}
          value={min}
          min={range.min}
          max={range.max}
          onChange={(event) => setMin(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && commit()}
        />
        <span className="text-faint" aria-hidden>
          –
        </span>
        <Input
          inputSize="sm"
          type="number"
          inputMode="numeric"
          placeholder="Max"
          aria-label={`Maximum ${facet.label}`}
          value={max}
          min={range.min}
          max={range.max}
          onChange={(event) => setMax(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => event.key === 'Enter' && commit()}
        />
      </div>
    </fieldset>
  )
}
