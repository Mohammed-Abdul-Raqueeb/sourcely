import type { ProductSpec, ProductView } from '@/lib/domain/catalog'
import type {
  CriterionOutcome,
  MatchExplanation,
  ScoreComponent,
  ScoreComponentKey,
  SearchIntent,
  SpecConstraint,
} from '@/lib/domain/search'
import { formatPrice, formatPriceBand } from '@/lib/format'
import {
  applicationOrIndustryLabel,
  getSpecDefinition,
  specEnumLabel,
} from './spec-registry'
import {
  BASE_WEIGHTS,
  COMPONENT_LABELS,
  toMatchPercent,
  weightsFor,
  type Weights,
} from './ranking-weights'

/**
 * The scoring model.
 *
 * Everything here is deterministic. No language model participates: the LLM
 * produces the `SearchIntent` that comes in, and may later rephrase the
 * `summary` that goes out, but the number and the criteria table are computed.
 * See ARCHITECTURE.md section 3.1 for why that boundary matters.
 */

export interface ScoringContext {
  /** Cosine similarity from the vector index, 0..1. */
  semantic: number
  /** BM25 normalised against the candidate set, 0..1. */
  lexical: number
  /** Category key that resolved for this search, for weight selection. */
  categoryKey?: string | null
  /** Highest metric values in the candidate set, for popularity normalisation. */
  maxViews: number
  maxRfqs: number
}

export interface ScoredProduct {
  score: number
  explanation: MatchExplanation
}

/* -------------------------------------------------------------------------- */
/* Component: specification match                                             */
/* -------------------------------------------------------------------------- */

const EXACT = 1.0
const COMPATIBLE = 0.6
const NEAR_NUMERIC = 0.5

function findSpec(product: ProductView, key: string): ProductSpec | undefined {
  return product.specs.find((spec) => spec.key === key)
}

interface SpecOutcome {
  /** 0..1 satisfaction of this single constraint. */
  satisfaction: number
  criterion: CriterionOutcome
}

function evaluateEnumConstraint(
  product: ProductView,
  constraint: SpecConstraint,
  requestedValues: string[]
): SpecOutcome {
  const definition = getSpecDefinition(constraint.key)
  const label = definition?.label ?? constraint.key
  const requested = requestedValues.map((v) => specEnumLabel(constraint.key, v)).join(' or ')
  const spec = findSpec(product, constraint.key)

  if (!spec?.valueText) {
    return {
      satisfaction: 0,
      criterion: {
        key: constraint.key,
        label,
        requested,
        actual: null,
        status: 'unknown',
        note: 'not published for this product',
      },
    }
  }

  const actual = spec.displayValue

  if (requestedValues.includes(spec.valueText)) {
    return {
      satisfaction: EXACT,
      criterion: { key: constraint.key, label, requested, actual, status: 'match' },
    }
  }

  // Partial credit for a documented substitute — a buyer asking for stainless
  // will often accept bronze; they will not accept uPVC.
  const compatible = requestedValues.some((requestedValue) => {
    const option = definition?.enumValues?.find((o) => o.value === requestedValue)
    return option?.compatibleWith?.includes(spec.valueText as string) ?? false
  })

  if (compatible) {
    return {
      satisfaction: COMPATIBLE,
      criterion: {
        key: constraint.key,
        label,
        requested,
        actual,
        status: 'partial',
        note: 'a commonly accepted substitute',
      },
    }
  }

  return {
    satisfaction: 0,
    criterion: { key: constraint.key, label, requested, actual, status: 'miss' },
  }
}

function evaluateNumericConstraint(
  product: ProductView,
  constraint: SpecConstraint
): SpecOutcome {
  const definition = getSpecDefinition(constraint.key)
  const label = definition?.label ?? constraint.key
  const unit = definition?.unit ? ` ${definition.unit}` : ''

  const requested =
    constraint.min != null && constraint.max != null
      ? constraint.min === constraint.max
        ? `${constraint.min}${unit}`
        : `${constraint.min}–${constraint.max}${unit}`
      : constraint.max != null
        ? `up to ${constraint.max}${unit}`
        : `at least ${constraint.min}${unit}`

  const spec = findSpec(product, constraint.key)

  if (spec?.valueNumber == null) {
    return {
      satisfaction: 0,
      criterion: {
        key: constraint.key,
        label,
        requested,
        actual: null,
        status: 'unknown',
        note: 'not published for this product',
      },
    }
  }

  const value = spec.valueNumber
  const actual = spec.displayValue
  const min = constraint.min ?? Number.NEGATIVE_INFINITY
  const max = constraint.max ?? Number.POSITIVE_INFINITY

  if (value >= min && value <= max) {
    return {
      satisfaction: EXACT,
      criterion: { key: constraint.key, label, requested, actual, status: 'match' },
    }
  }

  // Within 25% of the band edge is "one size out" in most product families —
  // worth showing with a caveat rather than hiding.
  const distance =
    value < min ? (min - value) / Math.max(1, Math.abs(min)) : (value - max) / Math.max(1, Math.abs(max))

  if (distance <= 0.25) {
    return {
      satisfaction: NEAR_NUMERIC,
      criterion: {
        key: constraint.key,
        label,
        requested,
        actual,
        status: 'partial',
        note: value < min ? 'slightly below the range you asked for' : 'slightly above the range you asked for',
      },
    }
  }

  return {
    satisfaction: 0,
    criterion: { key: constraint.key, label, requested, actual, status: 'miss' },
  }
}

function scoreSpecMatch(
  product: ProductView,
  intent: SearchIntent
): { raw: number; criteria: CriterionOutcome[] } {
  if (intent.specs.length === 0) {
    return { raw: 0.5, criteria: [] } // Neutral when nothing was asked.
  }

  let weightedSum = 0
  let totalWeight = 0
  const criteria: CriterionOutcome[] = []

  for (const constraint of intent.specs) {
    const definition = getSpecDefinition(constraint.key)
    const weight = definition?.rankWeight ?? 0.5

    const outcome =
      constraint.values && constraint.values.length > 0
        ? evaluateEnumConstraint(product, constraint, constraint.values)
        : evaluateNumericConstraint(product, constraint)

    weightedSum += outcome.satisfaction * weight
    totalWeight += weight
    criteria.push(outcome.criterion)
  }

  return {
    raw: totalWeight > 0 ? weightedSum / totalWeight : 0.5,
    criteria,
  }
}

/* -------------------------------------------------------------------------- */
/* Component: price fit                                                       */
/* -------------------------------------------------------------------------- */

function scorePriceFit(
  product: ProductView,
  intent: SearchIntent
): { raw: number; criterion: CriterionOutcome | null } {
  const { min, max } = intent.price
  if (min == null && max == null) return { raw: 0.5, criterion: null }

  const price = product.price
  const requested = formatPriceBand(min, max)
  const actual = formatPrice(price)

  const criterion = (status: CriterionOutcome['status'], note?: string): CriterionOutcome => ({
    key: 'price',
    label: 'Budget',
    requested,
    actual,
    status,
    note,
  })

  const aboveMax = max != null && price > max
  const belowMin = min != null && price < min

  if (!aboveMax && !belowMin) {
    return { raw: 1, criterion: criterion('match') }
  }

  if (aboveMax) {
    // A stated maximum is a hard constraint, but a product just over it is
    // worth surfacing with the overshoot named rather than silently dropped.
    const overshoot = (price - max) / max
    if (overshoot <= 0.15) {
      return {
        raw: 0.35,
        criterion: criterion(
          'partial',
          `${Math.round(overshoot * 100)}% over your budget`
        ),
      }
    }
    return { raw: 0, criterion: criterion('miss', 'above your budget') }
  }

  // Below a stated minimum usually signals a lower specification tier rather
  // than a bargain, so it is a soft penalty, not a rejection.
  const shortfall = (min! - price) / min!
  return {
    raw: Math.max(0.3, 1 - shortfall),
    criterion: criterion('partial', 'below the range you gave — check the specification tier'),
  }
}

/* -------------------------------------------------------------------------- */
/* Remaining components                                                       */
/* -------------------------------------------------------------------------- */

const AVAILABILITY_SCORE = {
  in_stock: 1,
  low_stock: 0.8,
  made_to_order: 0.45,
  out_of_stock: 0.05,
} as const

function scoreApplicationFit(
  product: ProductView,
  intent: SearchIntent
): { raw: number; criterion: CriterionOutcome | null } {
  const requestedApplications = [...intent.applications, ...intent.industries]
  if (requestedApplications.length === 0) return { raw: 0.5, criterion: null }

  const productSet = new Set([...product.applications, ...product.industries])
  const hits = requestedApplications.filter((application) => productSet.has(application))
  const raw = hits.length / requestedApplications.length

  // Hits mix both taxonomies, so both label maps apply — and the "requested"
  // line must name industry asks too, or an industry-only query reads as the
  // vague "stated use".
  const requested =
    requestedApplications.map(applicationOrIndustryLabel).join(', ') || 'stated use'
  const matched = hits.map(applicationOrIndustryLabel).join(', ')

  return {
    raw,
    criterion: {
      key: 'application',
      label: 'Application',
      requested,
      actual:
        matched || product.applications.map(applicationOrIndustryLabel).join(', ') || null,
      status: raw >= 0.99 ? 'match' : raw > 0 ? 'partial' : 'miss',
    },
  }
}

function scorePopularity(product: ProductView, context: ScoringContext): number {
  // Log damping so a product with 9,000 views does not simply outrank
  // everything with 900. Demand is a tiebreaker, not a ranking signal.
  const viewScore = Math.log1p(product.metrics.views) / Math.log1p(Math.max(1, context.maxViews))
  const rfqScore = Math.log1p(product.metrics.rfqs) / Math.log1p(Math.max(1, context.maxRfqs))
  return Math.min(1, viewScore * 0.5 + rfqScore * 0.5)
}

function scoreSellerTrust(product: ProductView): number {
  const fulfilment = product.seller.fulfilmentRate
  // 24 hours or worse contributes nothing; instant response contributes fully.
  const responsiveness = Math.max(0, 1 - product.seller.responseHours / 24)
  const verified = product.seller.verified ? 1 : 0.7
  return Math.min(1, (fulfilment * 0.6 + responsiveness * 0.4) * verified)
}

/* -------------------------------------------------------------------------- */
/* Explanation prose                                                          */
/* -------------------------------------------------------------------------- */

function buildHeadline(criteria: CriterionOutcome[]): string {
  const considered = criteria.filter((c) => c.status !== 'unknown')
  if (considered.length === 0) return 'Ranked on overall relevance to your description'

  const matched = considered.filter((c) => c.status === 'match').length
  const partial = considered.filter((c) => c.status === 'partial').length

  if (matched === considered.length) {
    return `Matches all ${considered.length} of your requirements`
  }
  if (partial > 0) {
    return `Matches ${matched} of ${considered.length} requirements, ${partial} close`
  }
  return `Matches ${matched} of ${considered.length} requirements`
}

/**
 * Templated prose built strictly from the criteria table.
 *
 * When Claude is configured it rewrites this into something more natural — but
 * it rewrites *these facts*. It is never given the freedom to assert a match
 * the scoring model did not find.
 */
function buildSummary(product: ProductView, criteria: CriterionOutcome[]): string {
  const matched = criteria.filter((c) => c.status === 'match')
  const missed = criteria.filter((c) => c.status === 'miss')
  const partial = criteria.filter((c) => c.status === 'partial')

  const parts: string[] = []

  if (matched.length > 0) {
    const list = matched.map((c) => `${c.label.toLowerCase()} (${c.actual})`).join(', ')
    parts.push(`Meets your requirement for ${list}.`)
  }

  if (partial.length > 0) {
    const list = partial
      .map((c) => `${c.label.toLowerCase()} is ${c.actual}${c.note ? ` — ${c.note}` : ''}`)
      .join('; ')
    parts.push(`Close on ${list}.`)
  }

  if (missed.length > 0) {
    const list = missed.map((c) => `${c.label.toLowerCase()} is ${c.actual}`).join(', ')
    parts.push(`Does not match on ${list}.`)
  }

  if (parts.length === 0) {
    parts.push(
      `${product.brand.name} ${product.category.name.toLowerCase()} matching the general description of what you asked for.`
    )
  }

  if (product.availability.state === 'in_stock') {
    parts.push('Available from ready stock.')
  } else if (product.availability.state === 'made_to_order') {
    parts.push(`Made to order, ${product.availability.leadTimeDays} day lead time.`)
  }

  return parts.join(' ')
}

/* -------------------------------------------------------------------------- */
/* Entry point                                                                */
/* -------------------------------------------------------------------------- */

export function scoreProduct(
  product: ProductView,
  intent: SearchIntent,
  context: ScoringContext
): ScoredProduct {
  const weights: Weights = weightsFor(context.categoryKey ?? product.category.key)

  const spec = scoreSpecMatch(product, intent)
  const price = scorePriceFit(product, intent)
  const application = scoreApplicationFit(product, intent)

  const raw: Record<ScoreComponentKey, number> = {
    specMatch: spec.raw,
    semantic: context.semantic,
    lexical: context.lexical,
    priceFit: price.raw,
    applicationFit: application.raw,
    availability: AVAILABILITY_SCORE[product.availability.state],
    popularity: scorePopularity(product, context),
    sellerTrust: scoreSellerTrust(product),
  }

  const components: ScoreComponent[] = (
    Object.keys(BASE_WEIGHTS) as ScoreComponentKey[]
  ).map((key) => ({
    key,
    label: COMPONENT_LABELS[key],
    weight: weights[key],
    raw: raw[key],
    weighted: weights[key] * raw[key],
  }))

  const score = components.reduce((sum, component) => sum + component.weighted, 0)

  const criteria: CriterionOutcome[] = [
    ...spec.criteria,
    ...(price.criterion ? [price.criterion] : []),
    ...(application.criterion ? [application.criterion] : []),
  ]

  return {
    score,
    explanation: {
      matchPercent: toMatchPercent(score),
      headline: buildHeadline(criteria),
      summary: buildSummary(product, criteria),
      criteria,
      components,
    },
  }
}
