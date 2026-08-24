import type { ProductView } from '@/lib/domain/catalog'
import type {
  CatalogQuery,
  Facet,
  FacetBucket,
  Page,
  RankedPage,
  RankedProduct,
  SearchIntent,
  SortKey,
  SpecConstraint,
} from '@/lib/domain/search'
import { applicationLabel, SPEC_DEFINITIONS, specEnumLabel } from './spec-registry'
import { BM25Index, normalizeScores, reciprocalRankFusion, tokenize } from './text'
import type { CorpusStats } from './corpus-stats'
import { embed, VectorIndex } from './vector'
import { RELEVANCE_FLOOR } from './ranking-weights'
import { scoreProduct, type ScoringContext } from './scoring'
import { AVAILABILITY_LABELS } from '@/lib/format'

/**
 * The catalogue search engine.
 *
 * Order of operations, per ARCHITECTURE.md section 3:
 *   constrain (hard filters)  ->  retrieve (BM25 + vector)  ->  score  ->  diversify
 *
 * Constraining first is what keeps this tractable: hard filters cut a 10,000
 * product catalogue to a few hundred before any similarity work happens.
 */

const DEFAULT_LIMIT = 24
const MAX_LIMIT = 96

/**
 * Cosine similarity at which a product joins a keyword result set without any
 * term overlap. Set high on purpose: the value of a keyword search is that it
 * is predictable, and semantic recall belongs on the assistant, which can
 * explain why it widened the search.
 */
const SEMANTIC_ADMIT_THRESHOLD = 0.5

/* -------------------------------------------------------------------------- */
/* Indexing                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Field-weighted document text. Name and tags are repeated because a term in
 * a product name is a far stronger signal than the same term buried in prose,
 * and BM25 has no native concept of fields.
 */
export function documentText(product: ProductView): string {
  const specText = product.specs.map((spec) => spec.displayValue).join(' ')
  const applications = product.applications.map(applicationLabel).join(' ')

  return [
    product.name,
    product.name,
    product.name,
    product.sku,
    product.brand.name,
    product.category.name,
    product.subcategory?.name ?? '',
    product.tags.join(' '),
    product.tags.join(' '),
    product.shortDescription,
    specText,
    applications,
    product.certifications.join(' '),
    product.description,
  ].join(' ')
}

/* -------------------------------------------------------------------------- */
/* Cursor                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Keyset cursor: the sort value and id of the last row on the previous page.
 * Opaque to callers. Base64url so it survives a query string untouched.
 */
interface Cursor {
  /** Sort key value of the last item returned. */
  k: number | string
  id: string
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'id' in parsed &&
      'k' in parsed &&
      typeof (parsed as Cursor).id === 'string'
    ) {
      return parsed as Cursor
    }
    return null
  } catch {
    // A malformed cursor is a client problem, not a server error — start over.
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Filtering                                                                  */
/* -------------------------------------------------------------------------- */

/** Which filter produced a predicate, so facet counts can exclude their own. */
type FilterKey = 'category' | 'brand' | 'price' | 'availability' | 'rating' | 'application' | `spec:${string}`

interface Predicate {
  key: FilterKey
  test: (product: ProductView) => boolean
}

function specPredicate(constraint: SpecConstraint): Predicate {
  return {
    key: `spec:${constraint.key}`,
    test: (product) => {
      const spec = product.specs.find((s) => s.key === constraint.key)
      if (!spec) return false

      if (constraint.values && constraint.values.length > 0) {
        return spec.valueText != null && constraint.values.includes(spec.valueText)
      }

      if (spec.valueNumber == null) return false
      if (constraint.min != null && spec.valueNumber < constraint.min) return false
      if (constraint.max != null && spec.valueNumber > constraint.max) return false
      return true
    },
  }
}

function buildPredicates(query: CatalogQuery, categoryTree: Map<string, string[]>): Predicate[] {
  const predicates: Predicate[] = []

  if (query.categoryKeys?.length) {
    const expanded = new Set(query.categoryKeys.flatMap((key) => categoryTree.get(key) ?? [key]))
    predicates.push({
      key: 'category',
      test: (product) =>
        expanded.has(product.category.key) ||
        (product.subcategory != null && expanded.has(product.subcategory.key)),
    })
  }

  if (query.brandKeys?.length) {
    const brands = new Set(query.brandKeys)
    predicates.push({ key: 'brand', test: (product) => brands.has(product.brand.key) })
  }

  if (query.price?.min != null || query.price?.max != null) {
    const { min, max } = query.price
    predicates.push({
      key: 'price',
      test: (product) =>
        (min == null || product.price >= min) && (max == null || product.price <= max),
    })
  }

  if (query.availability?.length) {
    const states = new Set(query.availability)
    predicates.push({
      key: 'availability',
      test: (product) => states.has(product.availability.state),
    })
  }

  if (query.applications?.length) {
    const applications = new Set(query.applications)
    predicates.push({
      key: 'application',
      test: (product) => product.applications.some((a) => applications.has(a)),
    })
  }

  if (query.minRating != null) {
    const minRating = query.minRating
    predicates.push({
      key: 'rating',
      test: (product) => (product.rating?.average ?? 0) >= minRating,
    })
  }

  for (const constraint of query.specs ?? []) {
    predicates.push(specPredicate(constraint))
  }

  return predicates
}

function applyPredicates(
  products: readonly ProductView[],
  predicates: Predicate[],
  exclude?: FilterKey
): ProductView[] {
  const active = exclude ? predicates.filter((p) => p.key !== exclude) : predicates
  if (active.length === 0) return [...products]
  return products.filter((product) => active.every((predicate) => predicate.test(product)))
}

/* -------------------------------------------------------------------------- */
/* Facets                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Facet counts exclude their own filter.
 *
 * Without this, selecting "Stainless Steel" would drop every other material to
 * zero and the user could never add a second material — the single most common
 * faceted-search bug, and one that makes a filter panel feel broken.
 */
function buildFacets(
  all: readonly ProductView[],
  predicates: Predicate[],
  query: CatalogQuery
): Facet[] {
  const facets: Facet[] = []

  /* --- Category --- */
  {
    const scope = applyPredicates(all, predicates, 'category')
    const counts = new Map<string, { label: string; count: number }>()
    for (const product of scope) {
      const existing = counts.get(product.category.key)
      counts.set(product.category.key, {
        label: product.category.name,
        count: (existing?.count ?? 0) + 1,
      })
    }
    const selected = new Set(query.categoryKeys ?? [])
    const buckets: FacetBucket[] = [...counts.entries()]
      .map(([value, { label, count }]) => ({ value, label, count, selected: selected.has(value) }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

    if (buckets.length > 1 || selected.size > 0) {
      facets.push({ key: 'category', label: 'Category', kind: 'enum', group: 'Catalogue', buckets, collapseAfter: 8 })
    }
  }

  /* --- Brand --- */
  {
    const scope = applyPredicates(all, predicates, 'brand')
    const counts = new Map<string, { label: string; count: number }>()
    for (const product of scope) {
      const existing = counts.get(product.brand.key)
      counts.set(product.brand.key, {
        label: product.brand.name,
        count: (existing?.count ?? 0) + 1,
      })
    }
    const selected = new Set(query.brandKeys ?? [])
    const buckets: FacetBucket[] = [...counts.entries()]
      .map(([value, { label, count }]) => ({ value, label, count, selected: selected.has(value) }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

    if (buckets.length > 1 || selected.size > 0) {
      facets.push({ key: 'brand', label: 'Brand', kind: 'enum', group: 'Catalogue', buckets, collapseAfter: 6 })
    }
  }

  /* --- Availability --- */
  {
    const scope = applyPredicates(all, predicates, 'availability')
    const counts = new Map<string, number>()
    for (const product of scope) {
      counts.set(product.availability.state, (counts.get(product.availability.state) ?? 0) + 1)
    }
    const selected = new Set(query.availability ?? [])
    const buckets: FacetBucket[] = [...counts.entries()]
      .map(([value, count]) => ({
        value,
        label: AVAILABILITY_LABELS[value as keyof typeof AVAILABILITY_LABELS] ?? value,
        count,
        selected: selected.has(value as never),
      }))
      .sort((a, b) => b.count - a.count)

    if (buckets.length > 1) {
      facets.push({ key: 'availability', label: 'Availability', kind: 'enum', group: 'Catalogue', buckets })
    }
  }

  /* --- Price --- */
  {
    const scope = applyPredicates(all, predicates, 'price')
    if (scope.length > 0) {
      const prices = scope.map((p) => p.price)
      facets.push({
        key: 'price',
        label: 'Price',
        kind: 'range',
        group: 'Commercial',
        range: {
          min: Math.min(...prices),
          max: Math.max(...prices),
          selectedMin: query.price?.min ?? null,
          selectedMax: query.price?.max ?? null,
        },
      })
    }
  }

  /* --- Specifications --- */
  // Only specs that are actually present in the current candidate set are
  // offered. Showing a "K-Factor" filter on a page of circuit breakers is how
  // a faceted catalogue starts to feel machine-generated.
  const filtered = applyPredicates(all, predicates)
  const presentKeys = new Set(filtered.flatMap((product) => product.specs.map((s) => s.key)))

  for (const definition of SPEC_DEFINITIONS) {
    if (!definition.isFilterable || !presentKeys.has(definition.key)) continue

    const facetKey: FilterKey = `spec:${definition.key}`
    const scope = applyPredicates(all, predicates, facetKey)
    const constraint = query.specs?.find((s) => s.key === definition.key)

    if (definition.dataType === 'enum') {
      const counts = new Map<string, number>()
      for (const product of scope) {
        const spec = product.specs.find((s) => s.key === definition.key)
        if (spec?.valueText) counts.set(spec.valueText, (counts.get(spec.valueText) ?? 0) + 1)
      }
      if (counts.size < 2) continue

      const selected = new Set(constraint?.values ?? [])
      const buckets: FacetBucket[] = [...counts.entries()]
        .map(([value, count]) => ({
          value,
          label: specEnumLabel(definition.key, value),
          count,
          selected: selected.has(value),
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))

      facets.push({
        key: definition.key,
        label: definition.label,
        kind: 'enum',
        group: 'Specification',
        buckets,
        collapseAfter: 6,
      })
    } else if (definition.dataType === 'number') {
      const values = scope
        .map((product) => product.specs.find((s) => s.key === definition.key)?.valueNumber)
        .filter((value): value is number => value != null)

      if (values.length < 2) continue
      const min = Math.min(...values)
      const max = Math.max(...values)
      if (min === max) continue

      facets.push({
        key: definition.key,
        label: definition.label,
        kind: 'range',
        group: 'Specification',
        range: {
          min,
          max,
          selectedMin: constraint?.min ?? null,
          selectedMax: constraint?.max ?? null,
          unit: definition.unit,
        },
      })
    }
  }

  return facets
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

function sortValue(product: ProductView, sort: SortKey, relevance: Map<string, number>): number {
  switch (sort) {
    case 'price_asc':
      return product.price
    case 'price_desc':
      return -product.price
    case 'newest':
      return -new Date(product.createdAt).getTime()
    case 'rating':
      return -(product.rating?.average ?? 0)
    case 'popular':
      return -(product.metrics.views + product.metrics.rfqs * 12)
    case 'relevance':
    default:
      return -(relevance.get(product.id) ?? 0)
  }
}

/* -------------------------------------------------------------------------- */
/* Index                                                                      */
/* -------------------------------------------------------------------------- */

export class CatalogIndex {
  readonly products: readonly ProductView[]
  readonly byId: ReadonlyMap<string, ProductView>
  readonly bySlug: ReadonlyMap<string, ProductView>

  private readonly lexical: BM25Index
  private readonly vectors = new VectorIndex()
  private readonly categoryTree: Map<string, string[]>
  private readonly maxViews: number
  private readonly maxRfqs: number

  /**
   * `corpus` is supplied when `products` is only a slice of the catalogue,
   * as it is on every Postgres query. Scoring then measures against the whole
   * catalogue rather than against whichever rows the constrain step returned,
   * so a match percentage means the same thing under both drivers.
   */
  constructor(products: readonly ProductView[], corpus: CorpusStats | null = null) {
    this.products = products
    this.byId = new Map(products.map((product) => [product.id, product]))
    this.bySlug = new Map(products.map((product) => [product.slug, product]))

    this.lexical = new BM25Index(
      products.map((product) => ({ id: product.id, text: documentText(product) })),
      corpus
    )

    for (const product of products) {
      this.vectors.add(product.id, embed(tokenize(documentText(product))))
    }

    // categoryKey -> [self, ...descendants], for filter expansion.
    this.categoryTree = new Map()
    for (const product of products) {
      const parentKey = product.category.key
      const existing = this.categoryTree.get(parentKey) ?? [parentKey]
      if (product.subcategory && !existing.includes(product.subcategory.key)) {
        existing.push(product.subcategory.key)
      }
      this.categoryTree.set(parentKey, existing)
      if (product.subcategory) {
        this.categoryTree.set(product.subcategory.key, [product.subcategory.key])
      }
    }

    this.maxViews = corpus?.maxViews ?? products.reduce((max, p) => Math.max(max, p.metrics.views), 1)
    this.maxRfqs = corpus?.maxRfqs ?? products.reduce((max, p) => Math.max(max, p.metrics.rfqs), 1)
  }

  /* ---------------------------------------------------------------- search */

  /** Traditional faceted search. Text is lexical + vector, never intent-parsed. */
  search(query: CatalogQuery): Page<ProductView> {
    const started = performance.now()

    const predicates = buildPredicates(query, this.categoryTree)
    const candidates = applyPredicates(this.products, predicates)
    const candidateIds = new Set(candidates.map((product) => product.id))

    let relevance = new Map<string, number>()
    let matched: Set<string> | null = null

    if (query.text && query.text.trim().length > 0) {
      const lexicalScores = this.lexical.search(query.text, candidateIds)
      const vectorScores = this.vectors.search(embed(tokenize(query.text)), candidateIds)

      // Vector similarity is non-zero for every document, so it cannot decide
      // membership on its own — only terms, or a genuinely strong semantic
      // signal, may admit a product to a keyword result set. Without this the
      // engine ranks but never filters, and a nonsense query returns the whole
      // catalogue in an arbitrary order.
      const semanticallyClose = new Map(
        [...vectorScores].filter(([, score]) => score >= SEMANTIC_ADMIT_THRESHOLD)
      )

      matched = new Set([...lexicalScores.keys(), ...semanticallyClose.keys()])
      relevance = reciprocalRankFusion([lexicalScores, semanticallyClose])
    }

    const sort: SortKey = query.sort ?? (query.text ? 'relevance' : 'popular')

    // A text query that matched nothing returns nothing. Falling back to
    // popularity would show an arbitrary page and imply it was a result.
    const matching = matched ? candidates.filter((product) => matched.has(product.id)) : candidates

    const sorted = [...matching].sort((a, b) => {
      const delta = sortValue(a, sort, relevance) - sortValue(b, sort, relevance)
      return delta !== 0 ? delta : a.id.localeCompare(b.id)
    })

    // Finite check rather than nullish: NaN is not nullish, so `??` lets it
    // through and it then poisons the slice into returning nothing. The
    // Postgres driver applies the same guard for the same reason.
    const limit = Number.isFinite(query.limit)
      ? Math.min(MAX_LIMIT, Math.max(1, query.limit as number))
      : DEFAULT_LIMIT
    const cursor = decodeCursor(query.cursor)
    const startIndex = cursor ? sorted.findIndex((product) => product.id === cursor.id) + 1 : 0
    const items = sorted.slice(startIndex, startIndex + limit)
    const last = items[items.length - 1]

    return {
      items,
      total: sorted.length,
      nextCursor:
        last && startIndex + limit < sorted.length
          ? encodeCursor({ k: sortValue(last, sort, relevance), id: last.id })
          : null,
      facets: buildFacets(this.products, predicates, query),
      tookMs: Math.round((performance.now() - started) * 100) / 100,
    }
  }

  /* ------------------------------------------------------------------ rank */

  /**
   * Intent-driven ranking — the assistant path.
   *
   * Only a stated price maximum and an explicit in-stock requirement act as
   * hard filters. Every other part of the intent is scored, so a buyer who
   * asks for stainless still sees the bronze alternative, clearly labelled as
   * a substitute rather than silently dropped.
   */
  rank(intent: SearchIntent, limit = 12): RankedPage {
    const hardQuery: CatalogQuery = {
      categoryKeys: intent.categoryKeys.length > 0 ? intent.categoryKeys : undefined,
      brandKeys: intent.brandKeys.length > 0 ? intent.brandKeys : undefined,
      price: intent.price.max != null ? { max: Math.round(intent.price.max * 1.15) } : undefined,
      availability: intent.requiresInStock ? ['in_stock', 'low_stock'] : undefined,
    }

    const predicates = buildPredicates(hardQuery, this.categoryTree)
    let candidates = applyPredicates(this.products, predicates)

    // If the category constraint eliminated everything, the parse was probably
    // wrong about the category. Fall back to the whole catalogue rather than
    // showing nothing — the score will sort it out.
    if (candidates.length === 0 && intent.categoryKeys.length > 0) {
      candidates = applyPredicates(
        this.products,
        buildPredicates({ ...hardQuery, categoryKeys: undefined }, this.categoryTree)
      )
    }

    // Stated negatives are absolute. Applied after the category fallback so a
    // "not brass" can never be reintroduced by widening the search.
    if (intent.excludedSpecs.length > 0) {
      const exclusions = intent.excludedSpecs.map(specPredicate)
      candidates = candidates.filter(
        (product) => !exclusions.some((exclusion) => exclusion.test(product))
      )
    }

    if (candidates.length === 0) return { results: [], total: 0 }

    const candidateIds = new Set(candidates.map((product) => product.id))
    const queryText = [intent.normalizedQuery, ...intent.keywords].join(' ')

    const lexical = normalizeScores(this.lexical.search(queryText, candidateIds))
    const semantic = this.vectors.search(embed(tokenize(queryText)), candidateIds)

    const context = (product: ProductView): ScoringContext => ({
      semantic: semantic.get(product.id) ?? 0,
      lexical: lexical.get(product.id) ?? 0,
      categoryKey: intent.categoryKeys[0] ?? product.category.key,
      maxViews: this.maxViews,
      maxRfqs: this.maxRfqs,
    })

    const scored: RankedProduct[] = candidates
      .map((product) => {
        const { score, explanation } = scoreProduct(product, intent, context(product))
        return { product, score, explanation }
      })
      .filter((result) => result.score >= RELEVANCE_FLOOR)
      .sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id))

    // `total` is every product above the relevance floor, not the page size.
    // Reporting the capped count as the total would make the assistant say
    // "found 12" whenever it found more, which is exactly the kind of
    // almost-true number this product exists to avoid.
    return { results: diversify(scored, limit), total: scored.length }
  }

  /**
   * Scores one product against one intent.
   *
   * Powers "Why this is recommended" on a product page reached from a search:
   * the buyer sees the same criteria table that produced the ranking, rather
   * than a fresh unexplained assertion.
   */
  explain(product: ProductView, intent: SearchIntent): RankedProduct {
    const queryText = [intent.normalizedQuery, ...intent.keywords].join(' ')
    const only = new Set([product.id])

    const lexical = normalizeScores(this.lexical.search(queryText, only))
    const semantic = this.vectors.search(embed(tokenize(queryText)), only)

    const { score, explanation } = scoreProduct(product, intent, {
      semantic: semantic.get(product.id) ?? 0,
      // BM25 normalised against a single document is always 1 or 0, which
      // would overstate the component. Damped so the explanation stays
      // consistent with the ranking the buyer arrived from.
      lexical: (lexical.get(product.id) ?? 0) * 0.6,
      categoryKey: intent.categoryKeys[0] ?? product.category.key,
      maxViews: this.maxViews,
      maxRfqs: this.maxRfqs,
    })

    return { product, score, explanation }
  }

  /** Total matching a set of filters, without paging. Used for facet previews. */
  count(query: CatalogQuery): number {
    return applyPredicates(this.products, buildPredicates(query, this.categoryTree)).length
  }

  related(product: ProductView, limit = 4): ProductView[] {
    const explicit = product.relatedProductIds
      .map((id) => this.byId.get(id))
      .filter((related): related is ProductView => related != null)

    if (explicit.length >= limit) return explicit.slice(0, limit)

    // Top up with same-subcategory products by vector similarity.
    const vector = this.vectors.get(product.id)
    if (!vector) return explicit.slice(0, limit)

    const taken = new Set([product.id, ...explicit.map((p) => p.id)])
    const nearby = [...this.vectors.search(vector).entries()]
      .filter(([id]) => !taken.has(id))
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => this.byId.get(id))
      .filter((candidate): candidate is ProductView => candidate != null)
      .filter((candidate) => candidate.category.id === product.category.id)

    return [...explicit, ...nearby].slice(0, limit)
  }
}

/* -------------------------------------------------------------------------- */
/* Diversification                                                            */
/* -------------------------------------------------------------------------- */

const MAX_PER_BRAND_IN_TOP = 2

/**
 * Caps how many results one brand can occupy on the page.
 *
 * A catalogue where one manufacturer makes the whole range will otherwise
 * return eight near-identical products, which is technically the best ranking
 * and practically useless — the buyer needs alternatives to choose between.
 *
 * Diversification changes *which* products are selected, never the order they
 * are shown in. The returned list is re-sorted by score, so match percentages
 * always read monotonically down the page — a 86% appearing below an 82% looks
 * like a bug to a user, whatever the justification.
 */
function diversify(ranked: RankedProduct[], limit: number): RankedProduct[] {
  const perBrand = new Map<string, number>()
  const selected: RankedProduct[] = []
  const deferred: RankedProduct[] = []

  for (const result of ranked) {
    const brandKey = result.product.brand.key
    const used = perBrand.get(brandKey) ?? 0

    if (used < MAX_PER_BRAND_IN_TOP && selected.length < limit) {
      selected.push(result)
      perBrand.set(brandKey, used + 1)
    } else {
      deferred.push(result)
    }
  }

  // If the brand cap left the page short, fill from the deferred pile rather
  // than returning three results when twelve were asked for.
  for (const result of deferred) {
    if (selected.length >= limit) break
    selected.push(result)
  }

  return selected.sort(
    (a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id)
  )
}
