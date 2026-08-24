/**
 * Assistant smoke test.
 *
 * Run: npm run smoke:assistant
 *
 * Covers the parts of the assistant that are logic rather than plumbing: the
 * information-gain follow-up, intent refinement, and the honesty rules the
 * narration has to hold — it must never claim a match the scoring engine
 * marked as a miss, and it must never report the page size as the total.
 */

process.env.SOURCELY_DATA_DIR ??= '.data-test'

import { rm } from 'node:fs/promises'
import { parseIntentOffline } from '../src/server/ai/intent-offline'
import { intentToChips, removeChip } from '../src/server/ai/chips'
import { applyFollowUp, buildFollowUp } from '../src/server/ai/follow-up'
import { OfflineProvider } from '../src/server/ai/provider'
import { CatalogIndex } from '../src/server/catalog/search-engine'
import { SEED_BRANDS, SEED_CATEGORIES, SEED_PRODUCTS, SEED_SELLERS } from '../src/server/seed'
import type { ProductView } from '../src/lib/domain/catalog'

let failures = 0
let checks = 0

function check(label: string, condition: boolean, detail = ''): void {
  checks++
  console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`)
  if (!condition) failures++
}

function section(title: string): void {
  console.log(`\n${'─'.repeat(74)}\n${title}\n${'─'.repeat(74)}`)
}

const categoryById = new Map(SEED_CATEGORIES.map((c) => [c.id, c]))
const brandById = new Map(SEED_BRANDS.map((b) => [b.id, b]))
const sellerById = new Map(SEED_SELLERS.map((s) => [s.id, s]))

const views: ProductView[] = SEED_PRODUCTS.map((product) => {
  const category = categoryById.get(product.categoryId)!
  const brand = brandById.get(product.brandId)!
  const seller = sellerById.get(product.sellerId)!
  return {
    ...product,
    category,
    subcategory: product.subcategoryId ? (categoryById.get(product.subcategoryId) ?? null) : null,
    brand,
    seller,
  }
})

const index = new CatalogIndex(views)
const provider = new OfflineProvider()

async function main() {
  /* ------------------------------------------------------------- follow-up */
  section('FOLLOW-UP QUESTION')

  const vague = parseIntentOffline('I need a valve for HVAC')
  const vaguePage = index.rank(vague, 12)
  const question = buildFollowUp(vague, vaguePage.results.map((r) => r.product))

  check('an under-specified query produces a follow-up', question !== null, question?.field ?? 'none')
  check('the follow-up offers tappable options', (question?.options.length ?? 0) >= 2, `${question?.options.length ?? 0} options`)
  check(
    'every option carries a result count',
    question?.options.every((option) => option.resultCount != null) ?? false
  )
  check(
    'options are not all the same size (the split is informative)',
    new Set(question?.options.map((o) => o.resultCount)).size > 1,
    question?.options.map((o) => `${o.label}:${o.resultCount}`).join(' ') ?? ''
  )
  check('the follow-up is skippable', question?.skippable === true)

  // A fully-specified query should not be interrogated further.
  const precise = parseIntentOffline(
    'SS316 threaded ball valve DN50 PN63 for HVAC under ₹5,000'
  )
  const precisePage = index.rank(precise, 12)
  check(
    'a precise query with few candidates is not asked a question',
    buildFollowUp(precise, precisePage.results.map((r) => r.product)) === null ||
      precisePage.results.length >= 6,
    `${precisePage.results.length} candidates`
  )

  /* ------------------------------------------------------------ refinement */
  section('REFINEMENT')

  const base = parseIntentOffline('I need a stainless steel threaded valve for HVAC')
  const baseCount = index.rank(base, 24).total

  const refined = applyFollowUp(base, 'valve_type', 'ball')
  check(
    'answering a follow-up ADDS a constraint, it does not reset',
    refined.specs.some((s) => s.key === 'material') &&
      refined.specs.some((s) => s.key === 'connection_type') &&
      refined.specs.some((s) => s.key === 'valve_type'),
    refined.specs.map((s) => s.key).join(', ')
  )

  const refinedTop = index.rank(refined, 12).results[0]
  check(
    'the refined top result is actually a ball valve',
    refinedTop?.product.specs.find((s) => s.key === 'valve_type')?.valueText === 'ball',
    refinedTop?.product.name ?? 'none'
  )

  const widened = removeChip(base, 'spec:material:stainless_steel')
  const widenedPage = index.rank(widened, 24)
  check(
    'removing a chip drops that constraint',
    !widened.specs.some((s) => s.key === 'material'),
    widened.specs.map((s) => s.key).join(', ')
  )
  check(
    'removing a constraint widens the result set',
    widenedPage.total >= baseCount,
    `${baseCount} → ${widenedPage.total}`
  )
  check(
    'the widened set includes materials the original excluded',
    new Set(
      widenedPage.results.map((r) => r.product.specs.find((s) => s.key === 'material')?.valueText)
    ).size > 1,
    [...new Set(widenedPage.results.map((r) => r.product.specs.find((s) => s.key === 'material')?.valueText))].join(', ')
  )

  const numeric = applyFollowUp(base, 'size_dn', '40:65')
  check(
    'a numeric band answer becomes a range constraint',
    numeric.specs.some((s) => s.key === 'size_dn' && s.min === 40 && s.max === 65)
  )

  const priced = applyFollowUp(base, 'price', ':5000')
  check('a price answer sets the ceiling', priced.price.max === 5000, String(priced.price.max))

  /* ----------------------------------------------------------------- chips */
  section('INTENT CHIPS')

  const chips = intentToChips(base)
  check('chips are produced', chips.length > 0, chips.map((c) => c.label).join(', '))
  check('every chip has a stable removable id', chips.every((c) => c.id.includes(':') || c.id === 'quantity'))
  check(
    'each chip round-trips through removeChip',
    chips
      .filter((chip) => chip.removable)
      .every((chip) => {
        const after = removeChip(base, chip.id)
        return intentToChips(after).length < chips.length
      })
  )

  /* ------------------------------------------------------------- narration */
  section('NARRATION HONESTY')

  const page = index.rank(base, 12)
  const prose = await provider.narrate({
    intent: base,
    results: page.results,
    totalMatches: page.total,
    followUp: null,
    history: [],
  })

  check('narration is produced', prose.length > 20, `${prose.length} chars`)
  check(
    'narration reports the TRUE total, not the page size',
    page.total === page.results.length || prose.includes(String(page.total)),
    `total=${page.total} shown=${page.results.length}`
  )
  check(
    'narration names the top product',
    page.results[0] != null && prose.includes(page.results[0].product.name),
    page.results[0]?.product.name ?? 'none'
  )
  check('narration contains no markdown', !/[*#_`]/.test(prose))

  // The critical honesty rule: a miss must never be described as a match.
  const missy = parseIntentOffline('cast iron flanged valve for HVAC under ₹2,000')
  const missyPage = index.rank(missy, 8)
  if (missyPage.results.length > 0) {
    const withMiss = missyPage.results.find((r) =>
      r.explanation.criteria.some((c) => c.status === 'miss')
    )
    check(
      'a product with a failing criterion is not described as satisfying it',
      withMiss == null ||
        !withMiss.explanation.criteria
          .filter((c) => c.status === 'miss')
          .some((c) => withMiss.explanation.summary.includes(`Meets your requirement for ${c.label.toLowerCase()}`)),
      withMiss ? withMiss.product.name : 'no misses in this set'
    )
  }

  // No results must produce a diagnosis, not an apology.
  const impossible = parseIntentOffline('titanium valve under ₹10')
  const impossiblePage = index.rank(impossible, 8)
  const emptyProse = await provider.narrate({
    intent: impossible,
    results: impossiblePage.results,
    totalMatches: impossiblePage.total,
    followUp: null,
    history: [],
  })
  check(
    'an empty result set explains what to change',
    impossiblePage.results.length > 0 ||
      /relax|remove|constraint|nearest|try/i.test(emptyProse),
    emptyProse.slice(0, 90)
  )

  /* ------------------------------------------------------------- comparison */
  section('COMPARISON')

  const toCompare = page.results.slice(0, 3).map((r) => r.product)
  const comparison = await provider.compare(toCompare)
  check('comparison prose is produced', comparison.length > 40, `${comparison.length} chars`)
  check(
    'comparison does not declare a single winner',
    !/\bbest choice\b|\bthe winner\b|\byou should buy\b/i.test(comparison)
  )
  check('single product returns guidance, not a comparison', (await provider.compare(toCompare.slice(0, 1))).includes('second'))

  /* ------------------------------------------------------------ conversation */
  section('CONVERSATIONAL GATE')

  const greeting = await provider.interpret('hi')
  check('a bare greeting is answered as conversation, not a search', greeting.kind === 'chat')
  check(
    'the greeting reply invites a requirement',
    greeting.kind === 'chat' && /sourc|describ|need|catalogue/i.test(greeting.reply),
    greeting.kind === 'chat' ? greeting.reply.slice(0, 70) : 'searched instead'
  )

  const meta = await provider.interpret('what can you do?')
  check('a capability question is answered as conversation', meta.kind === 'chat')

  const mixed = await provider.interpret('hi, I need a DN50 stainless steel ball valve')
  check(
    'a greeting carrying a requirement still searches',
    mixed.kind === 'search' && mixed.intent.categoryKeys.includes('valves'),
    mixed.kind
  )

  const { STARTER_PROMPTS } = await import('../src/components/assistant/starters')
  const starterKinds = await Promise.all(
    STARTER_PROMPTS.map((starter) => provider.interpret(starter.query))
  )
  check(
    'every starter prompt classifies as a search',
    starterKinds.every((result) => result.kind === 'search'),
    starterKinds.map((result) => result.kind).join(', ')
  )

  const terse = await provider.interpret('titanium widget')
  check('terse non-conversational input still searches', terse.kind === 'search')

  /* ---------------------------------------------------------------- provider */
  section('PROVIDER FALLBACK')

  check('offline provider reports itself honestly', provider.name === 'offline')
  check('offline provider is always configured', provider.configured === true)

  await rm('.data-test', { recursive: true, force: true }).catch(() => {})

  console.log(`\n${'='.repeat(74)}`)
  console.log(failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} CHECK(S) FAILED`)
  console.log('='.repeat(74))

  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('\nSMOKE RUN CRASHED\n', error)
  process.exit(1)
})
