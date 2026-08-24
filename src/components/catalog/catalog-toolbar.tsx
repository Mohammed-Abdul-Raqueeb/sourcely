'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutGrid, List, Search, Sparkles, X } from 'lucide-react'
import type { Facet, SortKey } from '@/lib/domain/search'
import { SORT_LABELS, SORT_KEYS } from '@/lib/domain/search'
import { cn } from '@/lib/cn'
import { AVAILABILITY_LABELS, formatPriceBand, pluralize } from '@/lib/format'
import {
  catalogHref,
  clearFilters,
  setPrice,
  setSpecRange,
  toggleAvailability,
  toggleListValue,
  toggleSpecValue,
  type CatalogParams,
} from '@/lib/catalog-params'
import { Chip } from '@/components/ui/badge'
import { Select } from '@/components/ui/input'

/**
 * Listing toolbar.
 *
 * Carries the one control the brief calls for explicitly: a switch between
 * traditional keyword search and AI search. They are genuinely different
 * operations — keyword search filters the catalogue, AI search parses intent
 * and ranks it — so presenting them as one box with a hidden mode would
 * mislead. The switch makes the difference visible and the choice deliberate.
 */

export type SearchMode = 'traditional' | 'ai'

export function CatalogToolbar({
  params,
  facets,
  total,
  tookMs,
  showing,
}: {
  params: CatalogParams
  facets: Facet[]
  total: number
  tookMs: number
  showing: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()

  const [mode, setMode] = useState<SearchMode>('traditional')
  const [text, setText] = useState(params.text ?? '')

  function navigate(next: CatalogParams) {
    startTransition(() => {
      router.push(catalogHref(next, pathname), { scroll: false })
    })
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    const query = text.trim()

    if (mode === 'ai') {
      // AI search is a different surface, not a different query string —
      // it needs conversation, follow-ups and an explanation panel.
      router.push(query ? `/assistant?q=${encodeURIComponent(query)}` : '/assistant')
      return
    }

    const { cursor: _cursor, ...rest } = params
    navigate({ ...(rest as CatalogParams), text: query || undefined })
  }

  return (
    <div className="space-y-4">
      {/* Search + mode ----------------------------------------------------- */}
      <form onSubmit={onSubmit} role="search" className="flex flex-col gap-2.5 sm:flex-row">
        <div
          className="inline-flex shrink-0 rounded-md border border-border bg-surface-2 p-0.5"
          role="radiogroup"
          aria-label="Search mode"
        >
          {(
            [
              { value: 'traditional', label: 'Keyword', icon: Search },
              { value: 'ai', label: 'AI search', icon: Sparkles },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={mode === option.value}
              onClick={() => setMode(option.value)}
              className={cn(
                'inline-flex h-9 items-center gap-1.5 rounded px-3 text-[13px] font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                mode === option.value
                  ? 'bg-surface text-text shadow-raise'
                  : 'text-muted hover:text-text'
              )}
            >
              <option.icon className="size-3.5" aria-hidden />
              {option.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint"
            aria-hidden
          />
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              mode === 'ai'
                ? 'Describe what you need — "stainless threaded valve for HVAC under ₹5,000"'
                : 'Search by name, SKU, brand or specification'
            }
            aria-label={mode === 'ai' ? 'Describe what you need' : 'Search products'}
            className={cn(
              'h-10 w-full rounded-md border border-border bg-surface-2 pr-24 pl-10 text-sm text-text',
              'placeholder:text-faint',
              'transition-[border-color,box-shadow] duration-150',
              'focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/25 focus:outline-none'
            )}
          />
          <button
            type="submit"
            className="absolute top-1/2 right-1.5 inline-flex h-7 -translate-y-1/2 items-center rounded bg-accent px-3 text-[13px] font-medium text-accent-ink transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {mode === 'ai' ? 'Ask' : 'Search'}
          </button>
        </div>
      </form>

      {/* Active filters ----------------------------------------------------- */}
      <ActiveFilters params={params} facets={facets} onApply={navigate} />

      {/* Count + sort + view ------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <p className="text-[13px] text-muted" aria-live="polite">
          <span className="font-medium text-text">{pluralize(total, 'product')}</span>
          {total > showing && <span className="text-faint"> · showing {showing}</span>}
          <span className="ml-2 font-mono text-[11px] text-faint tnum">{tookMs} ms</span>
        </p>

        <div className={cn('ml-auto flex items-center gap-2', pending && 'opacity-60')}>
          <label className="flex items-center gap-2 text-[13px] text-muted">
            <span className="hidden sm:inline">Sort</span>
            <Select
              selectSize="sm"
              value={params.sort ?? 'popular'}
              onChange={(event) => {
                const { cursor: _cursor, ...rest } = params
                navigate({ ...(rest as CatalogParams), sort: event.target.value as SortKey })
              }}
              className="w-44"
              aria-label="Sort products"
            >
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </Select>
          </label>

          <div
            className="hidden rounded-md border border-border bg-surface-2 p-0.5 sm:flex"
            role="radiogroup"
            aria-label="View mode"
          >
            {(
              [
                { value: 'grid', label: 'Grid view', icon: LayoutGrid },
                { value: 'list', label: 'List view', icon: List },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={params.view === option.value}
                aria-label={option.label}
                title={option.label}
                onClick={() => navigate({ ...params, view: option.value })}
                className={cn(
                  'grid size-8 place-items-center rounded transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  params.view === option.value
                    ? 'bg-surface text-text shadow-raise'
                    : 'text-muted hover:text-text'
                )}
              >
                <option.icon className="size-4" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Removable chips for every active filter.
 *
 * Labels are resolved from the facet data rather than the raw key, so a chip
 * reads "Stainless Steel" and not "stainless_steel".
 */
function ActiveFilters({
  params,
  facets,
  onApply,
}: {
  params: CatalogParams
  facets: Facet[]
  onApply: (next: CatalogParams) => void
}) {
  const chips: { id: string; qualifier: string; label: string; remove: () => void }[] = []

  const labelFor = (facetKey: string, value: string) =>
    facets
      .find((facet) => facet.key === facetKey)
      ?.buckets?.find((bucket) => bucket.value === value)?.label ?? value

  const facetLabel = (facetKey: string) =>
    facets.find((facet) => facet.key === facetKey)?.label ?? facetKey

  for (const key of params.categoryKeys ?? []) {
    chips.push({
      id: `cat-${key}`,
      qualifier: 'Category',
      label: labelFor('category', key),
      remove: () => onApply(toggleListValue(params, 'categoryKeys', key)),
    })
  }

  for (const key of params.brandKeys ?? []) {
    chips.push({
      id: `brand-${key}`,
      qualifier: 'Brand',
      label: labelFor('brand', key),
      remove: () => onApply(toggleListValue(params, 'brandKeys', key)),
    })
  }

  for (const state of params.availability ?? []) {
    chips.push({
      id: `avail-${state}`,
      qualifier: 'Stock',
      label: AVAILABILITY_LABELS[state],
      remove: () => onApply(toggleAvailability(params, state)),
    })
  }

  for (const constraint of params.specs ?? []) {
    if (constraint.values?.length) {
      for (const value of constraint.values) {
        chips.push({
          id: `spec-${constraint.key}-${value}`,
          qualifier: facetLabel(constraint.key),
          label: labelFor(constraint.key, value),
          remove: () => onApply(toggleSpecValue(params, constraint.key, value)),
        })
      }
    } else {
      const unit = facets.find((facet) => facet.key === constraint.key)?.range?.unit
      chips.push({
        id: `spec-${constraint.key}-range`,
        qualifier: facetLabel(constraint.key),
        label: `${constraint.min ?? '0'}–${constraint.max ?? '∞'}${unit ? ` ${unit}` : ''}`,
        remove: () => onApply(setSpecRange(params, constraint.key, null, null)),
      })
    }
  }

  if (params.price?.min != null || params.price?.max != null) {
    chips.push({
      id: 'price',
      qualifier: 'Budget',
      label: formatPriceBand(params.price.min, params.price.max),
      remove: () => onApply(setPrice(params, null, null)),
    })
  }

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Chip
          key={chip.id}
          qualifier={chip.qualifier}
          onRemove={chip.remove}
          removeLabel={`Remove ${chip.qualifier} filter ${chip.label}`}
        >
          {chip.label}
        </Chip>
      ))}

      <button
        type="button"
        onClick={() => onApply(clearFilters(params))}
        className="ml-1 inline-flex items-center gap-1 rounded px-2 py-1 text-[12px] font-medium text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <X className="size-3" aria-hidden />
        Clear all
      </button>
    </div>
  )
}
