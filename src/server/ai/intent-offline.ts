import type { SearchIntent, SpecConstraint } from '@/lib/domain/search'
import {
  APPLICATIONS,
  criticalSpecsForCategory,
  INDUSTRIES,
  SYNONYM_INDEX,
  SYNONYM_TERMS,
  getSpecDefinition,
} from '@/server/catalog/spec-registry'
import { CATEGORIES, BRANDS } from '@/server/seed/taxonomy'
import { normalize, tokenize } from '@/server/catalog/text'

/**
 * Deterministic natural-language intent parser.
 *
 * This is the `AI_PROVIDER=offline` implementation of step 1 in the pipeline.
 * It is a real parser, not a placeholder: unit extraction, synonym resolution
 * against the spec registry, category inference, negation handling and
 * confidence estimation. The whole product demos end to end with no API key.
 *
 * What it cannot do is generalise beyond the vocabulary it is given. Claude
 * handles that when configured; the output contract is identical, so nothing
 * downstream changes.
 */

/* -------------------------------------------------------------------------- */
/* Price                                                                      */
/* -------------------------------------------------------------------------- */

const MULTIPLIERS: Record<string, number> = {
  k: 1_000,
  thousand: 1_000,
  l: 100_000,
  lakh: 100_000,
  lac: 100_000,
  lakhs: 100_000,
  cr: 10_000_000,
  crore: 10_000_000,
  crores: 10_000_000,
}

function toAmount(digits: string, suffix?: string): number {
  const base = Number.parseFloat(digits)
  if (Number.isNaN(base)) return Number.NaN
  const multiplier = suffix ? (MULTIPLIERS[suffix] ?? 1) : 1
  return Math.round(base * multiplier)
}

const CURRENCY = String.raw`(?:₹|rs\.?|inr)?\s*`
const AMOUNT = String.raw`([\d]+(?:\.\d+)?)\s*(k|thousand|l|lakh|lac|lakhs|cr|crore|crores)?`

/**
 * Extracts a budget. Ordered most-specific first: a range pattern must be
 * tried before the bare maximum pattern, or "between 3000 and 5000" parses as
 * "under 3000".
 */
function extractPrice(text: string): { min?: number; max?: number; matched: string[] } {
  const matched: string[] = []

  const between = new RegExp(
    String.raw`(?:between|from)\s*${CURRENCY}${AMOUNT}\s*(?:and|to|-|–)\s*${CURRENCY}${AMOUNT}`,
    'i'
  ).exec(text)
  if (between?.[1] && between[3]) {
    matched.push(between[0])
    return {
      min: toAmount(between[1], between[2]),
      max: toAmount(between[3], between[4]),
      matched,
    }
  }

  const dashRange = new RegExp(
    String.raw`${CURRENCY}${AMOUNT}\s*(?:-|–|to)\s*${CURRENCY}${AMOUNT}\s*(?:budget|range|price)?`,
    'i'
  ).exec(text)
  if (dashRange?.[1] && dashRange[3] && /₹|rs|inr|budget|price/i.test(dashRange[0])) {
    matched.push(dashRange[0])
    return {
      min: toAmount(dashRange[1], dashRange[2]),
      max: toAmount(dashRange[3], dashRange[4]),
      matched,
    }
  }

  const upper = new RegExp(
    String.raw`(?:under|below|less than|lesser than|max|maximum|upto|up to|within|not more than|budget of|budget)\s*${CURRENCY}${AMOUNT}`,
    'i'
  ).exec(text)
  if (upper?.[1]) {
    matched.push(upper[0])
    return { max: toAmount(upper[1], upper[2]), matched }
  }

  const lower = new RegExp(
    String.raw`(?:over|above|more than|at least|minimum|min|starting at|starting from)\s*${CURRENCY}${AMOUNT}`,
    'i'
  ).exec(text)
  if (lower?.[1]) {
    matched.push(lower[0])
    return { min: toAmount(lower[1], lower[2]), matched }
  }

  return { matched }
}

/* -------------------------------------------------------------------------- */
/* Size and units                                                             */
/* -------------------------------------------------------------------------- */

const INCH_TO_DN: Record<string, number> = {
  '0.5': 15,
  '1/2': 15,
  '0.75': 20,
  '3/4': 20,
  '1': 25,
  '1.25': 32,
  '1-1/4': 32,
  '1.5': 40,
  '1-1/2': 40,
  '2': 50,
  '2.5': 65,
  '2-1/2': 65,
  '3': 80,
  '4': 100,
  '5': 125,
  '6': 150,
  '8': 200,
  '10': 250,
  '12': 300,
}

/**
 * Unit suffix to spec key. Where one unit serves two specs (bar is both a
 * valve pressure rating and a gauge measuring range) the ambiguity is resolved
 * after the category is known — see `disambiguate`.
 */
const UNIT_SPECS: { pattern: RegExp; key: string; ambiguousWith?: string }[] = [
  { pattern: /(\d+(?:\.\d+)?)\s*(?:kw|kilowatt)s?\b/i, key: 'power_kw' },
  { pattern: /(\d+(?:\.\d+)?)\s*ka\b/i, key: 'breaking_capacity_ka' },
  { pattern: /(\d+(?:\.\d+)?)\s*(?:amp|ampere|amps|a)\b/i, key: 'current_rating_a' },
  { pattern: /(\d+(?:\.\d+)?)\s*(?:volt|volts|v)\b/i, key: 'voltage_v' },
  { pattern: /(\d+(?:\.\d+)?)\s*(?:tr|ton|tons|tonne)s?\s*(?:of\s*)?(?:refrigeration|cooling)?\b/i, key: 'cooling_capacity_tr' },
  { pattern: /(\d+(?:\.\d+)?)\s*(?:m3\/h|m³\/h|cmh|cubic met(?:er|re)s? per hour)\b/i, key: 'flow_rate_m3h', ambiguousWith: 'airflow_cmh' },
  { pattern: /(\d+(?:\.\d+)?)\s*(?:m|met(?:er|re)s?)\s*(?:head|of head)\b/i, key: 'head_m' },
  { pattern: /(\d+(?:\.\d+)?)\s*(?:bar)\b/i, key: 'pressure_rating_bar', ambiguousWith: 'range_bar' },
  { pattern: /(\d+(?:\.\d+)?)\s*(?:°c|deg\s*c|degrees?\s*c|celsius)\b/i, key: 'temperature_max_c', ambiguousWith: 'temperature_rating_c' },
  { pattern: /(\d+(?:\.\d+)?)\s*(?:nm|newton met(?:er|re)s?)\b/i, key: 'torque_range_nm' },
  { pattern: /(\d+)\s*(?:pole|poles|p)\b/i, key: 'poles' },
  // Sprinkler K-factor. Written as K80 / K-115 / "K factor 80" in every
  // hydraulic calculation, and unambiguous in this catalogue — nothing else
  // uses a bare K prefix.
  { pattern: /\bk[\s-]?(?:factor\s*)?(\d{2,3})\b/i, key: 'k_factor' },
]

function extractSize(text: string): { constraint: SpecConstraint | null; matched: string[] } {
  const matched: string[] = []

  const dn = /\bdn\s?(\d+)\b/i.exec(text)
  if (dn?.[1]) {
    matched.push(dn[0])
    const value = Number.parseInt(dn[1], 10)
    return { constraint: { key: 'size_dn', min: value, max: value, hard: false }, matched }
  }

  const inch = /(\d+(?:[-.]\d+(?:\/\d+)?)?|\d+\/\d+)\s*(?:"|''|inch|inches|in\b)/i.exec(text)
  if (inch?.[1]) {
    const normalized = inch[1].replace(/\s+/g, '')
    const value = INCH_TO_DN[normalized]
    if (value) {
      matched.push(inch[0])
      return { constraint: { key: 'size_dn', min: value, max: value, hard: false }, matched }
    }
  }

  const mm = /\b(\d+(?:\.\d+)?)\s*mm\b/i.exec(text)
  if (mm?.[1]) {
    matched.push(mm[0])
    const value = Number.parseFloat(mm[1])
    return { constraint: { key: 'size_dn', min: value, max: value, hard: false }, matched }
  }

  return { constraint: null, matched }
}

/* -------------------------------------------------------------------------- */
/* Negation                                                                   */
/* -------------------------------------------------------------------------- */

const NEGATION = /\b(?:not|no|non|without|avoid|except|other than|excluding|rather than|instead of)[\s-]+([a-z0-9 ]{2,24})/gi

/**
 * Finds terms the buyer ruled out. A missed negation is worse than a missed
 * positive: showing someone the exact thing they said they did not want reads
 * as the system not having listened.
 */
function extractNegations(text: string): { excluded: Set<string>; spans: string[] } {
  const excluded = new Set<string>()
  const spans: string[] = []

  for (const match of text.matchAll(NEGATION)) {
    const phrase = match[1]?.trim()
    if (!phrase) continue

    // Try progressively shorter prefixes: "brass fittings" -> "brass".
    const words = phrase.split(/\s+/)
    for (let length = Math.min(3, words.length); length >= 1; length--) {
      const candidate = words.slice(0, length).join(' ')
      if (SYNONYM_INDEX.has(candidate)) {
        excluded.add(candidate)
        spans.push(match[0])
        break
      }
    }
  }

  return { excluded, spans }
}

/* -------------------------------------------------------------------------- */
/* Category inference                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Intent phrases that name a job rather than a product.
 *
 * This is the vocabulary-gap bridge described in ARCHITECTURE.md section 1 —
 * the buyer who writes "something to control water flow" instead of "valve".
 */
const CATEGORY_INTENT_PHRASES: Record<string, string[]> = {
  valves: [
    'control water flow', 'control the flow', 'regulate flow', 'regulate the flow',
    'isolate the flow', 'isolate flow', 'shut off water', 'shut off the water',
    'stop the water', 'stop water flow', 'isolation', 'shut-off', 'shutoff',
    'turn the water on and off', 'open and close the line',
  ],
  pumps: [
    'move water', 'pump water', 'boost pressure', 'boost the pressure',
    'lift water', 'circulate water', 'circulate the water', 'raise water',
    'increase water pressure', 'drain water', 'remove water',
  ],
  hvac: [
    'cool the building', 'cool the space', 'air conditioning', 'condition the air',
    'ventilate', 'fresh air', 'supply air', 'extract air', 'climate control',
    'heat the building', 'temperature control',
  ],
  electrical: [
    'protect the circuit', 'protect circuits', 'distribute power', 'switch power',
    'trip on fault', 'electrical protection', 'power distribution',
  ],
  'fire-fighting': [
    'fire protection', 'fire safety', 'sprinkler system', 'put out a fire',
    'suppress fire', 'fire suppression', 'detect fire',
  ],
  instrumentation: [
    'measure pressure', 'monitor pressure', 'measure temperature',
    'monitor temperature', 'measure flow', 'monitor flow', 'read the pressure',
  ],
  plumbing: [
    'carry water', 'run water', 'water distribution', 'pipe the water',
    'insulate the pipe', 'support the pipe',
  ],
  safety: [
    'protect workers', 'protect the hands', 'personal protection', 'ppe',
    'site safety', 'protect from falls',
  ],
  tools: ['tighten bolts', 'measure current', 'cut pipe', 'install pipework'],
  industrial: ['compress air', 'drive a motor', 'lift loads', 'vary the speed'],
}

/**
 * Product nouns and trade abbreviations that name a category directly.
 *
 * Category *names* alone are not enough: nobody types "Safety Equipment", they
 * type "gloves". This table is what turns the words a buyer actually uses into
 * a category, and it is the cheapest recall win in the whole parser.
 */
const CATEGORY_PRODUCT_NOUNS: Record<string, string[]> = {
  valves: ['valve', 'valves', 'strainer', 'nrv', 'prv', 'drv', 'butterfly', 'ball valve', 'gate valve'],
  pumps: ['pump', 'pumps', 'booster set', 'jockey pump', 'dosing pump', 'submersible'],
  hvac: ['ahu', 'air handling unit', 'fcu', 'fan coil', 'duct fan', 'inline fan', 'air filter', 'bag filter', 'pre-filter', 'chiller', 'diffuser', 'ductwork'],
  electrical: ['mccb', 'mcb', 'rccb', 'acb', 'breaker', 'breakers', 'circuit breaker', 'contactor', 'distribution board', 'cable tray', 'switchgear', 'busbar', 'isolator'],
  'fire-fighting': ['sprinkler', 'sprinklers', 'hydrant', 'landing valve', 'fire hose', 'hose reel', 'flow switch', 'extinguisher'],
  plumbing: ['pipe', 'pipes', 'tube', 'tubing', 'fitting', 'fittings', 'insulation', 'pipe clamp', 'elbow', 'reducer', 'flange'],
  instrumentation: ['gauge', 'gauges', 'pressure gauge', 'thermometer', 'transmitter', 'flow meter', 'flowmeter', 'magmeter', 'manometer', 'sensor'],
  tools: ['wrench', 'spanner', 'torque wrench', 'clamp meter', 'multimeter', 'pipe wrench', 'drill', 'grinder', 'tool', 'tools'],
  safety: ['gloves', 'glove', 'helmet', 'hard hat', 'goggles', 'harness', 'respirator', 'ppe', 'safety shoes', 'lanyard'],
  industrial: ['compressor', 'motor', 'gear motor', 'vfd', 'inverter drive', 'hoist', 'chain block', 'gearbox'],
}

/**
 * Every application and industry synonym, so a category whose *name* is also
 * an application term can be recognised and down-weighted.
 *
 * "a valve for an HVAC system" names HVAC as the application, not as the
 * category the buyer wants to shop in. Treating it as a category is how a
 * valve search ends up returning air filters.
 */
const APPLICATION_TERMS: ReadonlySet<string> = new Set([
  ...APPLICATIONS.flatMap((application) => [application.key, ...application.synonyms]),
  ...INDUSTRIES.flatMap((industry) => [industry.key, ...industry.synonyms]),
])

/**
 * Whole-term containment.
 *
 * Substring matching is not safe on this vocabulary: the application synonym
 * `ac` occurs inside `capacity`, `al` inside `metal`, `di` inside `dial`. Every
 * lookup in this parser goes through here.
 */
function containsTerm(text: string, term: string): boolean {
  if (term.length === 0) return false
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegex(term)}(?:$|[^a-z0-9])`, 'i').test(text)
}

interface CategoryScore {
  key: string
  score: number
}

function inferCategories(
  text: string,
  specConstraints: SpecConstraint[]
): { keys: string[]; matched: string[]; confidence: number } {
  const scores = new Map<string, number>()
  const matched: string[] = []

  const bump = (key: string, amount: number) => {
    scores.set(key, (scores.get(key) ?? 0) + amount)
  }

  // 1. Direct category or subcategory name.
  for (const category of CATEGORIES) {
    const name = category.name.toLowerCase()

    // Splitting a name on "&" can leave a token far too generic to match on.
    // "Head & Eye Protection" yields "head", which then fires on pump head,
    // sprinkler head and screw head — every one of them the wrong category.
    // The whole name is always safe; a fragment is only used when it is long
    // enough to be distinctive on its own.
    const segments = name.split(/\s*[&/]\s*/)
    const first = segments[0]?.trim() ?? name
    const bare = segments.length > 1 && first.length < 6 ? name : first

    // Singularise crudely: "valves" also matches "valve".
    const singular = bare.endsWith('s') ? bare.slice(0, -1) : bare

    if (containsTerm(text, bare) || (singular.length > 3 && containsTerm(text, singular))) {
      const targetKey = category.parentId
        ? (CATEGORIES.find((c) => c.id === category.parentId)?.key ?? category.key)
        : category.key

      // A category whose name doubles as an application term (HVAC, Plumbing,
      // Fire Fighting) is weak evidence of category on its own — the buyer is
      // usually naming the system the product goes into, not the aisle they
      // want to browse. A real product noun elsewhere in the query will
      // comfortably outweigh this.
      const isApplicationWord = APPLICATION_TERMS.has(bare) || APPLICATION_TERMS.has(singular)
      const weight = isApplicationWord ? 1.1 : category.parentId ? 2.5 : 3

      bump(targetKey, weight)
      matched.push(bare)
    }
  }

  // 2. Product nouns — the words buyers actually type.
  for (const [key, nouns] of Object.entries(CATEGORY_PRODUCT_NOUNS)) {
    for (const noun of nouns) {
      if (containsTerm(text, noun)) {
        bump(key, 2.8)
        matched.push(noun)
      }
    }
  }

  // 3. Job-to-be-done phrases.
  for (const [key, phrases] of Object.entries(CATEGORY_INTENT_PHRASES)) {
    for (const phrase of phrases) {
      if (text.includes(phrase)) {
        bump(key, 2.2)
        matched.push(phrase)
      }
    }
  }

  // 4. Specs imply their category. Asking for a K-factor means sprinklers even
  //    if the word "sprinkler" never appears.
  for (const constraint of specConstraints) {
    const definition = getSpecDefinition(constraint.key)
    if (!definition || definition.categoryKeys.length === 0) continue
    const share = 1.4 / definition.categoryKeys.length
    for (const categoryKey of definition.categoryKeys) {
      bump(categoryKey, share * definition.rankWeight)
    }
  }

  const ranked: CategoryScore[] = [...scores.entries()]
    .map(([key, score]) => ({ key, score }))
    .sort((a, b) => b.score - a.score)

  const best = ranked[0]
  if (!best || best.score < 1) return { keys: [], matched, confidence: 0 }

  // Keep runners-up only when genuinely competitive, so an ambiguous query
  // searches both plausible categories rather than guessing.
  const keys = ranked
    .filter((entry) => entry.score >= best.score * 0.7)
    .slice(0, 2)
    .map((entry) => entry.key)

  const runnerUp = ranked[1]?.score ?? 0
  const confidence = Math.min(1, best.score / 3) * (runnerUp > 0 ? 1 - (runnerUp / best.score) * 0.35 : 1)

  return { keys, matched, confidence }
}

/* -------------------------------------------------------------------------- */
/* Disambiguation                                                             */
/* -------------------------------------------------------------------------- */

/** Resolves unit collisions once the category is known. */
function disambiguate(constraints: SpecConstraint[], categoryKeys: string[]): SpecConstraint[] {
  const category = categoryKeys[0]
  if (!category) return constraints

  return constraints.map((constraint) => {
    const definition = getSpecDefinition(constraint.key)
    if (!definition) return constraint
    if (definition.categoryKeys.length === 0) return constraint
    if (definition.categoryKeys.includes(category)) return constraint

    const rule = UNIT_SPECS.find((entry) => entry.key === constraint.key)
    if (!rule?.ambiguousWith) return constraint

    const alternative = getSpecDefinition(rule.ambiguousWith)
    if (alternative?.categoryKeys.includes(category)) {
      return { ...constraint, key: rule.ambiguousWith }
    }
    return constraint
  })
}

/* -------------------------------------------------------------------------- */
/* Parser                                                                     */
/* -------------------------------------------------------------------------- */

const IN_STOCK_PHRASES = [
  'in stock', 'ready stock', 'ex stock', 'immediately', 'urgent', 'urgently',
  'available now', 'same day', 'right away', 'asap',
]

const QUANTITY = /\b(?:qty|quantity|need|require|want|order)?\s*(\d{1,5})\s*(?:nos\.?|numbers?|units?|pieces?|pcs\.?|sets?)\b/i

export function parseIntentOffline(rawQuery: string): SearchIntent {
  const text = normalize(rawQuery)
  const consumed: string[] = []

  /* --- Negations first, so a negated term is never taken as a positive --- */
  const { excluded, spans } = extractNegations(text)
  consumed.push(...spans)

  // Resolve each ruled-out term to the spec value it names, so the engine can
  // filter on it rather than just avoiding it as a positive constraint.
  const excludedBySpec = new Map<string, Set<string>>()
  for (const term of excluded) {
    for (const hit of SYNONYM_INDEX.get(term) ?? []) {
      const values = excludedBySpec.get(hit.specKey) ?? new Set<string>()
      values.add(hit.value)
      excludedBySpec.set(hit.specKey, values)
    }
  }
  const excludedSpecs: SpecConstraint[] = [...excludedBySpec].map(([key, values]) => ({
    key,
    values: [...values],
    hard: true,
  }))

  /* --- Price --- */
  const price = extractPrice(text)
  consumed.push(...price.matched)

  /* --- Quantity --- */
  let quantity: number | null = null
  const quantityMatch = QUANTITY.exec(text)
  if (quantityMatch?.[1]) {
    const value = Number.parseInt(quantityMatch[1], 10)
    // Guard against swallowing a size or a price as a quantity.
    if (value > 0 && value <= 100_000 && !consumed.some((span) => span.includes(quantityMatch[1] as string))) {
      quantity = value
      consumed.push(quantityMatch[0])
    }
  }

  /* --- Numeric specs by unit --- */
  const specs: SpecConstraint[] = []
  for (const rule of UNIT_SPECS) {
    const match = rule.pattern.exec(text)
    if (!match?.[1]) continue
    if (consumed.some((span) => span.includes(match[0]))) continue

    const value = Number.parseFloat(match[1])
    if (Number.isNaN(value)) continue

    specs.push({ key: rule.key, min: value, max: value, hard: false })
    consumed.push(match[0])
  }

  /* --- Size --- */
  const size = extractSize(text)
  if (size.constraint && !consumed.some((span) => span.includes(size.matched[0] ?? ' '))) {
    specs.push(size.constraint)
    consumed.push(...size.matched)
  }

  /* --- Enum specs by synonym, longest term first --- */
  const enumValues = new Map<string, Set<string>>()
  let remaining = text
  for (const term of SYNONYM_TERMS) {
    if (excluded.has(term)) continue
    // Word-boundary match so "ss" does not fire inside "stainless".
    const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(term)}(?:$|[^a-z0-9])`, 'i')
    if (!pattern.test(remaining)) continue

    const hits = SYNONYM_INDEX.get(term)
    if (!hits?.length) continue

    for (const hit of hits) {
      const values = enumValues.get(hit.specKey) ?? new Set<string>()
      values.add(hit.value)
      enumValues.set(hit.specKey, values)
    }

    consumed.push(term)
    // Blank the matched span so a shorter synonym cannot re-match inside it.
    remaining = remaining.replace(pattern, ' ')
  }

  for (const [key, values] of enumValues) {
    specs.push({ key, values: [...values], hard: false })
  }

  /* --- Applications & industries --- */
  const applications: string[] = []
  for (const application of APPLICATIONS) {
    const hit = application.synonyms.find((synonym) => containsTerm(text, synonym))
    if (hit) {
      applications.push(application.key)
      consumed.push(hit)
    }
  }

  const industries: string[] = []
  for (const industry of INDUSTRIES) {
    const hit = industry.synonyms.find((synonym) => containsTerm(text, synonym))
    if (hit) {
      industries.push(industry.key)
      consumed.push(hit)
    }
  }

  /* --- Brands --- */
  const brandKeys: string[] = []
  for (const brand of BRANDS) {
    const name = brand.name.toLowerCase()
    const firstWord = name.split(' ')[0] ?? name
    if (containsTerm(text, name) || (firstWord.length > 4 && containsTerm(text, firstWord))) {
      brandKeys.push(brand.key)
      consumed.push(firstWord)
    }
  }

  /* --- Category --- */
  const category = inferCategories(text, specs)
  consumed.push(...category.matched)

  const resolvedSpecs = disambiguate(specs, category.keys)

  /* --- Availability --- */
  const requiresInStock = IN_STOCK_PHRASES.some((phrase) => text.includes(phrase))

  /* --- Residual keywords --- */
  const consumedTokens = new Set(consumed.flatMap((span) => tokenize(span)))
  const keywords = tokenize(text).filter((token) => !consumedTokens.has(token))

  /* --- Confidence: how much of the query did we account for? --- */
  const allTokens = tokenize(text)
  const coverage = allTokens.length === 0 ? 0 : 1 - keywords.length / allTokens.length
  const structureBonus = Math.min(
    0.3,
    resolvedSpecs.length * 0.06 + (price.max != null || price.min != null ? 0.08 : 0) + applications.length * 0.05
  )
  const confidence = Math.max(
    0.1,
    Math.min(1, coverage * 0.55 + category.confidence * 0.3 + structureBonus)
  )

  /* --- Which critical fields are still unanswered? --- */
  const providedKeys = new Set(resolvedSpecs.map((constraint) => constraint.key))
  const missingCriticalFields = category.keys[0]
    ? criticalSpecsForCategory(category.keys[0])
        .filter((definition) => !providedKeys.has(definition.key))
        .map((definition) => definition.key)
    : []

  return {
    rawQuery,
    normalizedQuery: text,
    categoryKeys: category.keys,
    brandKeys,
    specs: resolvedSpecs,
    price: { ...(price.min != null && { min: price.min }), ...(price.max != null && { max: price.max }) },
    applications,
    industries,
    quantity,
    requiresInStock,
    keywords,
    excludedTerms: [...excluded],
    excludedSpecs,
    confidence: Math.round(confidence * 100) / 100,
    missingCriticalFields,
    source: 'offline',
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
