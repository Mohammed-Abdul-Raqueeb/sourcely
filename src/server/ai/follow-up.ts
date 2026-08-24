import 'server-only'
import type { ProductView } from '@/lib/domain/catalog'
import type { FollowUpOption, FollowUpQuestion, SearchIntent } from '@/lib/domain/search'
import { formatPriceBand } from '@/lib/format'
import {
  criticalSpecsForCategory,
  getSpecDefinition,
  specEnumLabel,
} from '@/server/catalog/spec-registry'

/**
 * The single follow-up question.
 *
 * A buyer who is asked five questions answers none of them. So the assistant
 * asks exactly one, and it asks the one that most reduces the candidate set —
 * the field with the highest expected information gain, per ARCHITECTURE.md
 * section 3.3.
 *
 * Concretely: for each unanswered critical spec, measure how evenly the
 * remaining candidates split across its values. A field where 90% of products
 * share one value teaches almost nothing; one that splits the set into three
 * even groups eliminates roughly two-thirds of it. Shannon entropy over the
 * value distribution ranks exactly that.
 */

/** Below this many candidates, narrowing further is not worth a question. */
const MIN_CANDIDATES_TO_ASK = 6

/** A field offering fewer than two distinct values cannot narrow anything. */
const MIN_DISTINCT_VALUES = 2

/** More options than this on a chip row is a menu, not a question. */
const MAX_OPTIONS = 5

interface Candidate {
  key: string
  entropy: number
  options: FollowUpOption[]
  /** Fraction of candidates that publish this spec at all. */
  coverage: number
}

/** Shannon entropy in bits over a value-count distribution. */
function entropy(counts: number[], total: number): number {
  if (total === 0) return 0
  return counts.reduce((sum, count) => {
    if (count === 0) return sum
    const p = count / total
    return sum - p * Math.log2(p)
  }, 0)
}

/**
 * Buckets a numeric spec into the ranges a buyer would actually recognise.
 * Nominal bore is asked as discrete sizes; everything else as tertiles.
 */
function numericOptions(key: string, values: number[]): FollowUpOption[] {
  const definition = getSpecDefinition(key)
  const unit = definition?.unit ? ` ${definition.unit}` : ''
  const distinct = [...new Set(values)].sort((a, b) => a - b)

  // Few enough distinct values: offer them directly.
  if (distinct.length <= MAX_OPTIONS) {
    return distinct.map((value) => ({
      value: String(value),
      label: key === 'size_dn' ? `DN${value}` : `${value}${unit}`,
      resultCount: values.filter((entry) => entry === value).length,
    }))
  }

  // Otherwise split into three bands at the tertiles.
  const sorted = [...values].sort((a, b) => a - b)
  const lower = sorted[Math.floor(sorted.length / 3)] ?? sorted[0] ?? 0
  const upper = sorted[Math.floor((sorted.length * 2) / 3)] ?? sorted[sorted.length - 1] ?? 0

  return [
    {
      value: `:${lower}`,
      label: `Up to ${lower}${unit}`,
      resultCount: values.filter((v) => v <= lower).length,
    },
    {
      value: `${lower}:${upper}`,
      label: `${lower}–${upper}${unit}`,
      resultCount: values.filter((v) => v > lower && v <= upper).length,
    },
    {
      value: `${upper}:`,
      label: `Over ${upper}${unit}`,
      resultCount: values.filter((v) => v > upper).length,
    },
  ].filter((option) => (option.resultCount ?? 0) > 0)
}

/**
 * Phrases the question in the buyer's terms rather than the schema's.
 *
 * "What is the body material?" is a question a procurement manager answers.
 * "Select a value for material" is a form field.
 */
const QUESTION_TEMPLATES: Record<string, string> = {
  material: 'What should the body be made of?',
  valve_type: 'What kind of valve is this — isolation, non-return, or regulating?',
  connection_type: 'How does it connect to the pipework?',
  size_dn: 'What line size are you working with?',
  current_rating_a: 'What current rating do you need?',
  breaking_capacity_ka: 'What short-circuit rating does the installation require?',
  poles: 'How many poles?',
  cooling_capacity_tr: 'Roughly what cooling capacity do you need?',
  flow_rate_m3h: 'What flow rate does the duty call for?',
  head_m: 'How much head does the pump need to deliver?',
  temperature_rating_c: 'What bulb temperature rating does the design specify?',
  range_bar: 'What pressure range should it read?',
  phase: 'Single phase or three phase?',
  operation: 'How should it be operated?',
}

function questionFor(key: string): string {
  const template = QUESTION_TEMPLATES[key]
  if (template) return template
  const label = getSpecDefinition(key)?.label ?? key.replace(/_/g, ' ')
  return `What ${label.toLowerCase()} do you need?`
}

/* -------------------------------------------------------------------------- */

export function buildFollowUp(
  intent: SearchIntent,
  candidates: ProductView[]
): FollowUpQuestion | null {
  // Enough already, or too few to be worth narrowing.
  if (candidates.length < MIN_CANDIDATES_TO_ASK) return null

  const categoryKey = intent.categoryKeys[0]
  const answered = new Set(intent.specs.map((constraint) => constraint.key))

  // Price is a critical field in its own right and is not in the spec registry.
  if (intent.price.min == null && intent.price.max == null && candidates.length >= 10) {
    const prices = candidates.map((product) => product.price).sort((a, b) => a - b)
    const lower = prices[Math.floor(prices.length / 3)]
    const upper = prices[Math.floor((prices.length * 2) / 3)]

    if (lower != null && upper != null && upper > lower * 1.4) {
      return {
        field: 'price',
        question: 'Do you have a budget in mind? It changes what I put in front of you.',
        options: [
          {
            value: `:${lower}`,
            label: formatPriceBand(undefined, lower),
            resultCount: prices.filter((price) => price <= lower).length,
          },
          {
            value: `${lower}:${upper}`,
            label: formatPriceBand(lower, upper),
            resultCount: prices.filter((price) => price > lower && price <= upper).length,
          },
          {
            value: `${upper}:`,
            label: formatPriceBand(upper, undefined),
            resultCount: prices.filter((price) => price > upper).length,
          },
        ],
        skippable: true,
      }
    }
  }

  if (!categoryKey) return null

  const unanswered = criticalSpecsForCategory(categoryKey).filter(
    (definition) => !answered.has(definition.key)
  )
  if (unanswered.length === 0) return null

  /* --- Score each unanswered field by information gain ------------------- */

  const scored: Candidate[] = []

  for (const definition of unanswered) {
    const present = candidates.filter((product) =>
      product.specs.some((spec) => spec.key === definition.key)
    )

    const coverage = present.length / candidates.length
    // A field two-thirds of the catalogue does not publish is a dead end.
    if (coverage < 0.6) continue

    if (definition.dataType === 'enum' || definition.dataType === 'text') {
      const counts = new Map<string, number>()
      for (const product of present) {
        const value = product.specs.find((spec) => spec.key === definition.key)?.valueText
        if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
      }
      if (counts.size < MIN_DISTINCT_VALUES) continue

      const options: FollowUpOption[] = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_OPTIONS)
        .map(([value, count]) => ({
          value,
          label: specEnumLabel(definition.key, value),
          resultCount: count,
        }))

      scored.push({
        key: definition.key,
        entropy: entropy([...counts.values()], present.length) * definition.rankWeight,
        options,
        coverage,
      })
      continue
    }

    if (definition.dataType === 'number') {
      const values = present
        .map((product) => product.specs.find((spec) => spec.key === definition.key)?.valueNumber)
        .filter((value): value is number => value != null)

      const distinct = new Set(values)
      if (distinct.size < MIN_DISTINCT_VALUES) continue

      const options = numericOptions(definition.key, values)
      if (options.length < MIN_DISTINCT_VALUES) continue

      scored.push({
        key: definition.key,
        entropy:
          entropy(
            options.map((option) => option.resultCount ?? 0),
            values.length
          ) * definition.rankWeight,
        options,
        coverage,
      })
    }
  }

  if (scored.length === 0) return null

  scored.sort((a, b) => b.entropy - a.entropy || b.coverage - a.coverage)
  const best = scored[0]
  if (!best || best.entropy < 0.35) return null

  return {
    field: best.key,
    question: questionFor(best.key),
    options: best.options,
    skippable: true,
  }
}

/**
 * Folds a follow-up answer back into the intent.
 *
 * Numeric answers arrive as `min:max` (either side optional) so a band and an
 * exact value share one encoding.
 */
export function applyFollowUp(
  intent: SearchIntent,
  field: string,
  value: string
): SearchIntent {
  if (field === 'price') {
    const [min, max] = value.split(':')
    return {
      ...intent,
      price: {
        ...(min ? { min: Number.parseInt(min, 10) } : {}),
        ...(max ? { max: Number.parseInt(max, 10) } : {}),
      },
    }
  }

  const definition = getSpecDefinition(field)
  const specs = intent.specs.filter((constraint) => constraint.key !== field)

  if (definition?.dataType === 'number') {
    if (value.includes(':')) {
      const [min, max] = value.split(':')
      specs.push({
        key: field,
        ...(min ? { min: Number.parseFloat(min) } : {}),
        ...(max ? { max: Number.parseFloat(max) } : {}),
      })
    } else {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed)) specs.push({ key: field, min: parsed, max: parsed })
    }
  } else {
    specs.push({ key: field, values: [value] })
  }

  return {
    ...intent,
    specs,
    missingCriticalFields: intent.missingCriticalFields.filter((key) => key !== field),
  }
}
