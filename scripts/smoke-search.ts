/**
 * Search engine smoke test.
 *
 * Run: npm run smoke
 *
 * Exercises the offline intent parser and the ranking engine against the
 * canonical demo queries from the product brief. Not a substitute for the
 * unit suite in phase 6 — this is the fast feedback loop while the engine is
 * being built, and it prints enough to judge ranking *quality*, not just that
 * the code did not throw.
 */

import { parseIntentOffline } from '../src/server/ai/intent-offline'
import { CatalogIndex } from '../src/server/catalog/search-engine'
import { SEED_BRANDS, SEED_CATEGORIES, SEED_PRODUCTS, SEED_SELLERS } from '../src/server/seed'
import type { ProductView } from '../src/lib/domain/catalog'

const categoryById = new Map(SEED_CATEGORIES.map((c) => [c.id, c]))
const brandById = new Map(SEED_BRANDS.map((b) => [b.id, b]))
const sellerById = new Map(SEED_SELLERS.map((s) => [s.id, s]))

const views: ProductView[] = SEED_PRODUCTS.map((product) => {
  const category = categoryById.get(product.categoryId)
  const brand = brandById.get(product.brandId)
  const seller = sellerById.get(product.sellerId)
  if (!category || !brand || !seller) throw new Error(`unresolved taxonomy for ${product.sku}`)
  return {
    ...product,
    category,
    subcategory: product.subcategoryId ? (categoryById.get(product.subcategoryId) ?? null) : null,
    brand,
    seller,
  }
})

const index = new CatalogIndex(views)

const inr = (value: number) => `₹${value.toLocaleString('en-IN')}`
const pad = (value: string, width: number) => value.padEnd(width).slice(0, width)

console.log('='.repeat(78))
console.log(`CATALOGUE  ${SEED_PRODUCTS.length} products · ${SEED_CATEGORIES.filter((c) => !c.parentId).length} categories · ${SEED_BRANDS.length} brands · ${SEED_SELLERS.length} sellers`)
console.log('='.repeat(78))

const QUERIES = [
  'I need a stainless steel threaded valve for an HVAC system, preferably between ₹3,000 and ₹5,000, suitable for industrial use.',
  'I need something to control water flow in a commercial HVAC system. It should be stainless steel and work with a threaded connection.',
  'Show me industrial pumps for high-pressure applications.',
  'I need a budget-friendly electrical breaker for a commercial building.',
  'Find HVAC equipment suitable for a large warehouse.',
  'I need a valve for HVAC.',
  'DN50 ball valve, not brass, in stock, 50 nos',
  'pressure gauge 0-16 bar for chilled water',
  '100A 3 pole MCCB with 25kA breaking capacity',
  'cut resistant gloves size L under 500',
]

let failures = 0

for (const query of QUERIES) {
  const started = performance.now()
  const intent = parseIntentOffline(query)
  const { results } = index.rank(intent, 5)
  const elapsed = (performance.now() - started).toFixed(1)

  console.log(`\n${'─'.repeat(78)}`)
  console.log(`QUERY  ${query}`)
  console.log(`${'─'.repeat(78)}`)

  const chips: string[] = []
  if (intent.categoryKeys.length) chips.push(`category=${intent.categoryKeys.join('|')}`)
  if (intent.brandKeys.length) chips.push(`brand=${intent.brandKeys.join('|')}`)
  for (const spec of intent.specs) {
    if (spec.values) chips.push(`${spec.key}=${spec.values.join('|')}`)
    else chips.push(`${spec.key}=${spec.min ?? ''}..${spec.max ?? ''}`)
  }
  if (intent.price.min != null || intent.price.max != null) {
    chips.push(`price=${intent.price.min ?? ''}..${intent.price.max ?? ''}`)
  }
  if (intent.applications.length) chips.push(`app=${intent.applications.join('|')}`)
  if (intent.industries.length) chips.push(`industry=${intent.industries.join('|')}`)
  if (intent.quantity) chips.push(`qty=${intent.quantity}`)
  if (intent.requiresInStock) chips.push('in-stock')
  if (intent.excludedTerms.length) chips.push(`NOT ${intent.excludedTerms.join('|')}`)

  console.log(`INTENT   ${chips.join('  ') || '(nothing extracted)'}`)
  console.log(`         confidence=${intent.confidence}  missing=[${intent.missingCriticalFields.join(', ')}]`)
  console.log(`RESULTS  ${results.length} shown in ${elapsed}ms`)

  if (results.length === 0) {
    failures++
    console.log('         !! NO RESULTS')
    continue
  }

  for (const result of results) {
    const { product, explanation } = result
    console.log(
      `  ${String(explanation.matchPercent).padStart(3)}%  ${pad(product.sku, 16)} ${pad(product.name, 46)} ${inr(product.price).padStart(11)}`
    )
    const detail = explanation.criteria
      .map((c) => `${c.status === 'match' ? '+' : c.status === 'partial' ? '~' : c.status === 'miss' ? 'x' : '?'}${c.label}`)
      .join(' ')
    if (detail) console.log(`        ${detail}`)
  }
}

/* ---------------------------------------------------------------- assertions */

console.log(`\n${'='.repeat(78)}`)
console.log('ASSERTIONS')
console.log('='.repeat(78))

function check(label: string, condition: boolean, detail = ''): void {
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
  if (!condition) failures++
}

// The canonical brief query must put a stainless threaded valve on top.
const canonical = index.rank(
  parseIntentOffline(
    'I need a stainless steel threaded valve for an HVAC system, preferably between ₹3,000 and ₹5,000, suitable for industrial use.'
  ),
  8
).results
const top = canonical[0]
check(
  'canonical query returns results',
  canonical.length > 0,
  `${canonical.length} results`
)
check(
  'top result is a stainless steel valve',
  top?.product.specs.find((s) => s.key === 'material')?.valueText === 'stainless_steel',
  top?.product.name ?? 'none'
)
check(
  'top result is threaded',
  top?.product.specs.find((s) => s.key === 'connection_type')?.valueText === 'threaded',
  top?.product.specs.find((s) => s.key === 'connection_type')?.displayValue ?? 'none'
)
check(
  'top result is inside the stated budget',
  (top?.product.price ?? 0) >= 3000 && (top?.product.price ?? 0) <= 5000,
  top ? `₹${top.product.price}` : 'none'
)
check(
  'brass alternative is ranked below every stainless match',
  (() => {
    const brassIndex = canonical.findIndex((r) => r.product.sku === 'VTK-BVB-050')
    const worstStainless = canonical.reduce(
      (worst, r, i) =>
        r.product.specs.find((s) => s.key === 'material')?.valueText === 'stainless_steel' ? i : worst,
      -1
    )
    return brassIndex === -1 || brassIndex > worstStainless
  })(),
  'material mismatch must not outrank an exact match'
)

// Vocabulary gap: no product noun in the query at all.
const vocabGap = parseIntentOffline(
  'I need something to control water flow in a commercial HVAC system. It should be stainless steel and work with a threaded connection.'
)
check(
  'infers "valves" from a description with no product noun',
  vocabGap.categoryKeys.includes('valves'),
  `got [${vocabGap.categoryKeys.join(', ')}]`
)

// Negation must not be read as a positive.
const negation = parseIntentOffline('DN50 ball valve, not brass, in stock')
check(
  'negated material is excluded, not selected',
  !negation.specs.some((s) => s.key === 'material' && s.values?.includes('brass')),
  `excluded=[${negation.excludedTerms.join(', ')}]`
)
check('detects an in-stock requirement', negation.requiresInStock)
const negatedResults = index.rank(negation, 8).results
check(
  'no ruled-out product appears in the results',
  !negatedResults.some((r) => r.product.specs.some((s) => s.key === 'material' && s.valueText === 'brass')),
  negatedResults.map((r) => r.product.sku).join(', ')
)

// Under-specified query must produce a follow-up candidate.
const vague = parseIntentOffline('I need a valve for HVAC.')
check(
  'under-specified query reports missing critical fields',
  vague.missingCriticalFields.length > 0,
  `missing=[${vague.missingCriticalFields.join(', ')}]`
)

// Determinism: the same query must produce byte-identical rankings.
const runA = index.rank(parseIntentOffline('stainless steel threaded valve hvac'), 6).results
const runB = index.rank(parseIntentOffline('stainless steel threaded valve hvac'), 6).results
check(
  'ranking is deterministic across runs',
  JSON.stringify(runA.map((r) => [r.product.id, r.explanation.matchPercent])) ===
    JSON.stringify(runB.map((r) => [r.product.id, r.explanation.matchPercent]))
)

// Match percent must stay inside its declared band.
const allPercents = canonical.map((r) => r.explanation.matchPercent)
check(
  'match percent never reaches 100 and never drops below 42',
  allPercents.every((p) => p >= 42 && p <= 97),
  `range ${Math.min(...allPercents)}–${Math.max(...allPercents)}`
)

/* ------------------------------------------------------------- faceted search */

const faceted = index.search({ categoryKeys: ['valves'], sort: 'price_asc', limit: 5 })
check('faceted search returns a page', faceted.items.length > 0, `${faceted.total} total`)
check(
  'price_asc sort is actually ascending',
  faceted.items.every((item, i) => i === 0 || item.price >= (faceted.items[i - 1]?.price ?? 0))
)
check('facets are produced', faceted.facets.length > 0, `${faceted.facets.length} facets`)
check(
  'facet counts exclude their own filter',
  (() => {
    const withMaterial = index.search({
      categoryKeys: ['valves'],
      specs: [{ key: 'material', values: ['stainless_steel'] }],
    })
    const materialFacet = withMaterial.facets.find((f) => f.key === 'material')
    const nonZero = materialFacet?.buckets?.filter((b) => b.count > 0).length ?? 0
    return nonZero > 1
  })(),
  'a selected facet must still show its siblings'
)

// Keyword search must FILTER, not merely re-rank. Regression guard: vector
// similarity is non-zero for every document, so a naive hybrid returns the
// whole catalogue for any query at all.
const keywordHit = index.search({ text: 'mccb', limit: 50 })
check(
  'keyword search narrows the catalogue',
  keywordHit.total > 0 && keywordHit.total < index.products.length,
  `${keywordHit.total} of ${index.products.length}`
)
check(
  'keyword search puts the matching product first',
  keywordHit.items[0]?.sku.includes('MCCB') ?? false,
  keywordHit.items[0]?.sku ?? 'none'
)
const keywordMiss = index.search({ text: 'zzzznomatchanywhere', limit: 50 })
check(
  'a nonsense query returns nothing',
  keywordMiss.total === 0,
  `${keywordMiss.total} results`
)

const cursorPage1 = index.search({ sort: 'price_asc', limit: 10 })
const cursorPage2 = index.search({ sort: 'price_asc', limit: 10, cursor: cursorPage1.nextCursor ?? undefined })
check(
  'cursor pagination does not repeat items',
  cursorPage2.items.every((item) => !cursorPage1.items.some((first) => first.id === item.id)),
  `page1=${cursorPage1.items.length} page2=${cursorPage2.items.length}`
)

console.log(`\n${'='.repeat(78)}`)
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`)
console.log('='.repeat(78))

process.exit(failures === 0 ? 0 : 1)
