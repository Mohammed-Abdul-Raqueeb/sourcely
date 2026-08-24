import type { ScoreComponentKey } from '@/lib/domain/search'

/**
 * Ranking weights.
 *
 * These are product parameters, not implementation details. They are exposed
 * read-only in the admin dashboard so search quality can be reasoned about and
 * tuned without a deploy — see ARCHITECTURE.md section 3.2.
 *
 * Invariant: every weight set sums to 1.0. `normalizeWeights` enforces it so a
 * category override cannot silently inflate total scores.
 */

export type Weights = Record<ScoreComponentKey, number>

export const COMPONENT_LABELS: Record<ScoreComponentKey, string> = {
  specMatch: 'Specification match',
  semantic: 'Semantic similarity',
  lexical: 'Keyword relevance',
  priceFit: 'Price fit',
  applicationFit: 'Application fit',
  availability: 'Availability',
  popularity: 'Demand signal',
  sellerTrust: 'Seller reliability',
}

export const COMPONENT_EXPLANATIONS: Record<ScoreComponentKey, string> = {
  specMatch:
    'How many of the requested specifications the product actually satisfies, weighted by how much each one matters for its category.',
  semantic:
    'Similarity between the meaning of the request and the product description in vector space.',
  lexical: 'Direct keyword overlap, scored with BM25 against the candidate set.',
  priceFit: 'Position within the stated budget. A hard maximum zeroes this component.',
  applicationFit: 'Whether the product is documented for the stated application.',
  availability: 'Ready stock ranks above lead-time items, which rank above made-to-order.',
  popularity: 'Log-damped view and enquiry counts. A tiebreaker only — never a driver.',
  sellerTrust: 'Seller fulfilment rate and median quotation response time.',
}

export const BASE_WEIGHTS: Weights = {
  specMatch: 0.34,
  semantic: 0.22,
  lexical: 0.14,
  priceFit: 0.12,
  applicationFit: 0.08,
  availability: 0.05,
  popularity: 0.03,
  sellerTrust: 0.02,
}

/**
 * Per-category deviations from the base model, with the reasoning recorded.
 * Only the differing keys are listed; the rest are inherited and the whole set
 * is renormalised.
 */
export const CATEGORY_WEIGHT_OVERRIDES: Record<string, Partial<Weights>> = {
  // Electrical protection is a compliance decision. A breaker that does not
  // match the required rating is not a cheaper alternative, it is wrong.
  electrical: { specMatch: 0.46, semantic: 0.14, priceFit: 0.08 },

  // Same argument, more strongly: sprinkler bulb rating and K-factor are set
  // by the hydraulic design, not by preference.
  'fire-fighting': { specMatch: 0.48, semantic: 0.12, priceFit: 0.06 },

  // Pump selection is a duty-point problem — flow and head dominate.
  pumps: { specMatch: 0.44, semantic: 0.15, priceFit: 0.09 },

  // Consumables and PPE are bought on price and availability far more than on
  // fine specification differences.
  safety: { specMatch: 0.24, priceFit: 0.18, availability: 0.12, popularity: 0.06 },
  tools: { specMatch: 0.26, priceFit: 0.16, availability: 0.1, popularity: 0.06 },
}

function normalizeWeights(weights: Weights): Weights {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0)
  if (total === 0) return BASE_WEIGHTS
  const normalized = {} as Weights
  for (const key of Object.keys(weights) as ScoreComponentKey[]) {
    normalized[key] = weights[key] / total
  }
  return normalized
}

/**
 * Resolves the weight set for a category, falling back to the base model.
 * Always renormalised, so overrides cannot change the achievable maximum.
 */
export function weightsFor(categoryKey?: string | null): Weights {
  if (!categoryKey) return BASE_WEIGHTS
  const override = CATEGORY_WEIGHT_OVERRIDES[categoryKey]
  if (!override) return BASE_WEIGHTS
  return normalizeWeights({ ...BASE_WEIGHTS, ...override })
}

/* -------------------------------------------------------------------------- */
/* Score to presentation                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Products scoring below this are not shown at all. Padding a result page with
 * things that do not match is how a search surface loses a user's trust.
 */
export const RELEVANCE_FLOOR = 0.16

/** The score at which the presentation saturates. */
const SCORE_CEILING = 0.88

export const MIN_DISPLAY_PERCENT = 42
export const MAX_DISPLAY_PERCENT = 97

/**
 * Maps a raw 0..1 score onto the displayed match percentage.
 *
 * Deliberately never reaches 100: a catalogue cannot know that a product is a
 * perfect answer to a human requirement, and claiming so is a trust liability.
 * The floor exists because a "12% match" is not a match — it is noise wearing
 * a number.
 */
export function toMatchPercent(score: number): number {
  const span = SCORE_CEILING - RELEVANCE_FLOOR
  const position = (score - RELEVANCE_FLOOR) / span
  const percent =
    MIN_DISPLAY_PERCENT + position * (MAX_DISPLAY_PERCENT - MIN_DISPLAY_PERCENT)
  return Math.max(
    MIN_DISPLAY_PERCENT,
    Math.min(MAX_DISPLAY_PERCENT, Math.round(percent))
  )
}
