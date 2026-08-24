import type { AvailabilityState } from './domain/catalog'
import { AVAILABILITY_STATES } from './domain/catalog'
import { SORT_KEYS, type CatalogQuery, type SortKey, type SpecConstraint } from './domain/search'

/**
 * URL <-> CatalogQuery.
 *
 * Filter state lives in the URL, not in React state. That is what makes a
 * filtered result set shareable, bookmarkable, back-button-correct and
 * server-rendered — all four of which a client-side filter panel gives up.
 *
 * Shared by client and server, so it must stay free of any server import.
 *
 * Encoding:
 *   q       free text
 *   cat     category keys, comma separated
 *   brand   brand keys
 *   avail   availability states
 *   app     application keys
 *   min,max price band in whole rupees
 *   sort    sort key
 *   view    grid | list
 *   cursor  opaque pagination cursor
 *   s_<key> spec filter — `a,b,c` for enums, `min:max` for ranges
 */

export const SPEC_PREFIX = 's_'

export type ViewMode = 'grid' | 'list'

export interface CatalogParams extends CatalogQuery {
  view: ViewMode
}

function list(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function number(value: string | undefined): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

/**
 * Next.js hands page components a plain object whose values may be string or
 * string[]. Normalising here keeps that shape out of the rest of the app.
 */
export type RawSearchParams = Record<string, string | string[] | undefined>

function first(raw: RawSearchParams, key: string): string | undefined {
  const value = raw[key]
  return Array.isArray(value) ? value[0] : value
}

export function parseCatalogParams(raw: RawSearchParams): CatalogParams {
  const specs: SpecConstraint[] = []

  for (const [key, rawValue] of Object.entries(raw)) {
    if (!key.startsWith(SPEC_PREFIX)) continue
    const specKey = key.slice(SPEC_PREFIX.length)
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue
    if (!value) continue

    if (value.includes(':')) {
      const [min, max] = value.split(':')
      const constraint: SpecConstraint = { key: specKey }
      const parsedMin = number(min)
      const parsedMax = number(max)
      if (parsedMin != null) constraint.min = parsedMin
      if (parsedMax != null) constraint.max = parsedMax
      if (constraint.min != null || constraint.max != null) specs.push(constraint)
    } else {
      const values = list(value)
      if (values.length > 0) specs.push({ key: specKey, values })
    }
  }

  const sortRaw = first(raw, 'sort')
  const sort: SortKey | undefined = SORT_KEYS.includes(sortRaw as SortKey)
    ? (sortRaw as SortKey)
    : undefined

  const availability = list(first(raw, 'avail')).filter((state): state is AvailabilityState =>
    AVAILABILITY_STATES.includes(state as AvailabilityState)
  )

  const min = number(first(raw, 'min'))
  const max = number(first(raw, 'max'))

  const query: CatalogParams = {
    view: first(raw, 'view') === 'list' ? 'list' : 'grid',
    sort: sort ?? (first(raw, 'q') ? 'relevance' : 'popular'),
  }

  const text = first(raw, 'q')?.trim()
  if (text) query.text = text

  const categoryKeys = list(first(raw, 'cat'))
  if (categoryKeys.length) query.categoryKeys = categoryKeys

  const brandKeys = list(first(raw, 'brand'))
  if (brandKeys.length) query.brandKeys = brandKeys

  const applications = list(first(raw, 'app'))
  if (applications.length) query.applications = applications

  if (availability.length) query.availability = availability
  if (specs.length) query.specs = specs
  if (min != null || max != null) {
    query.price = { ...(min != null && { min }), ...(max != null && { max }) }
  }

  const cursor = first(raw, 'cursor')
  if (cursor) query.cursor = cursor

  return query
}

/**
 * Serialises back to a query string. Omits defaults so a clean listing URL
 * stays `/products` rather than `/products?sort=popular&view=grid`.
 */
export function toSearchParams(params: Partial<CatalogParams>): URLSearchParams {
  const search = new URLSearchParams()

  if (params.text) search.set('q', params.text)
  if (params.categoryKeys?.length) search.set('cat', params.categoryKeys.join(','))
  if (params.brandKeys?.length) search.set('brand', params.brandKeys.join(','))
  if (params.applications?.length) search.set('app', params.applications.join(','))
  if (params.availability?.length) search.set('avail', params.availability.join(','))
  if (params.price?.min != null) search.set('min', String(params.price.min))
  if (params.price?.max != null) search.set('max', String(params.price.max))

  for (const constraint of params.specs ?? []) {
    if (constraint.values?.length) {
      search.set(`${SPEC_PREFIX}${constraint.key}`, constraint.values.join(','))
    } else if (constraint.min != null || constraint.max != null) {
      search.set(
        `${SPEC_PREFIX}${constraint.key}`,
        `${constraint.min ?? ''}:${constraint.max ?? ''}`
      )
    }
  }

  const defaultSort: SortKey = params.text ? 'relevance' : 'popular'
  if (params.sort && params.sort !== defaultSort) search.set('sort', params.sort)
  if (params.view === 'list') search.set('view', 'list')
  if (params.cursor) search.set('cursor', params.cursor)

  return search
}

export function catalogHref(params: Partial<CatalogParams>, pathname = '/products'): string {
  const search = toSearchParams(params).toString()
  return search ? `${pathname}?${search}` : pathname
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Every filter change clears the cursor. Keeping a cursor across a filter
 * change resumes from a position in a result set that no longer exists.
 */
function reset(params: CatalogParams): CatalogParams {
  const { cursor: _cursor, ...rest } = params
  return rest as CatalogParams
}

export function toggleListValue(
  params: CatalogParams,
  field: 'categoryKeys' | 'brandKeys' | 'applications',
  value: string
): CatalogParams {
  const current = params[field] ?? []
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value]
  return { ...reset(params), [field]: next.length ? next : undefined }
}

export function toggleAvailability(
  params: CatalogParams,
  value: AvailabilityState
): CatalogParams {
  const current = params.availability ?? []
  const next = current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value]
  return { ...reset(params), availability: next.length ? next : undefined }
}

export function toggleSpecValue(
  params: CatalogParams,
  key: string,
  value: string
): CatalogParams {
  const specs = [...(params.specs ?? [])]
  const index = specs.findIndex((constraint) => constraint.key === key)
  const existing = index >= 0 ? specs[index] : undefined

  if (!existing?.values) {
    specs.push({ key, values: [value] })
  } else {
    const values = existing.values.includes(value)
      ? existing.values.filter((entry) => entry !== value)
      : [...existing.values, value]
    if (values.length === 0) specs.splice(index, 1)
    else specs[index] = { ...existing, values }
  }

  return { ...reset(params), specs: specs.length ? specs : undefined }
}

export function setSpecRange(
  params: CatalogParams,
  key: string,
  min: number | null,
  max: number | null
): CatalogParams {
  const specs = (params.specs ?? []).filter((constraint) => constraint.key !== key)
  if (min != null || max != null) {
    specs.push({ key, ...(min != null && { min }), ...(max != null && { max }) })
  }
  return { ...reset(params), specs: specs.length ? specs : undefined }
}

export function setPrice(
  params: CatalogParams,
  min: number | null,
  max: number | null
): CatalogParams {
  if (min == null && max == null) {
    const { price: _price, ...rest } = reset(params)
    return rest as CatalogParams
  }
  return {
    ...reset(params),
    price: { ...(min != null && { min }), ...(max != null && { max }) },
  }
}

export function clearFilters(params: CatalogParams): CatalogParams {
  // Text and view survive a filter reset — the user cleared filters, not their
  // search, and silently discarding the query is a hostile surprise.
  return { view: params.view, sort: params.sort, ...(params.text && { text: params.text }) }
}

export function hasActiveFilters(params: CatalogParams): boolean {
  return Boolean(
    params.categoryKeys?.length ||
      params.brandKeys?.length ||
      params.applications?.length ||
      params.availability?.length ||
      params.specs?.length ||
      params.price?.min != null ||
      params.price?.max != null
  )
}

export function activeFilterCount(params: CatalogParams): number {
  return (
    (params.categoryKeys?.length ?? 0) +
    (params.brandKeys?.length ?? 0) +
    (params.applications?.length ?? 0) +
    (params.availability?.length ?? 0) +
    (params.specs ?? []).reduce(
      (sum, constraint) => sum + (constraint.values?.length ?? 1),
      0
    ) +
    (params.price?.min != null || params.price?.max != null ? 1 : 0)
  )
}
