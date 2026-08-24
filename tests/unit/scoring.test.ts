import { describe, expect, it } from 'vitest'
import type { ProductView } from '@/lib/domain/catalog'
import type { SearchIntent } from '@/lib/domain/search'
import { scoreProduct } from '@/server/catalog/scoring'
import {
  BASE_WEIGHTS,
  MAX_DISPLAY_PERCENT,
  MIN_DISPLAY_PERCENT,
  RELEVANCE_FLOOR,
  toMatchPercent,
  weightsFor,
} from '@/server/catalog/ranking-weights'

/**
 * The scoring model is the one place in this product where a number is put in
 * front of a buyer as a fact. These tests pin the properties that make that
 * defensible: it is deterministic, it is bounded, and it never reports a miss
 * as a match.
 */

function product(overrides: Partial<ProductView> = {}): ProductView {
  return {
    id: 'prod_test',
    slug: 'test',
    sku: 'TEST-1',
    name: 'Test Ball Valve',
    shortDescription: 'Test',
    description: 'Test',
    categoryId: 'cat_valves',
    subcategoryId: 'cat_ball-valves',
    brandId: 'brand_vantek',
    sellerId: 'seller_metro-industrial',
    price: 4000,
    listPrice: null,
    currency: 'INR',
    priceUnit: 'per unit',
    taxRatePercent: 18,
    status: 'active',
    availability: {
      state: 'in_stock',
      quantityOnHand: 40,
      leadTimeDays: 1,
      minOrderQuantity: 1,
      unit: 'unit',
    },
    images: [],
    specs: [
      { key: 'material', valueText: 'stainless_steel', displayValue: 'Stainless Steel' },
      { key: 'connection_type', valueText: 'threaded', displayValue: 'Threaded' },
      { key: 'size_dn', valueNumber: 50, unit: 'DN', displayValue: 'DN50' },
    ],
    applications: ['hvac'],
    industries: [],
    tags: [],
    documents: [],
    warrantyMonths: 24,
    certifications: [],
    relatedProductIds: [],
    rating: { average: 4.5, count: 10 },
    metrics: { views: 100, rfqs: 5, saves: 5 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    category: {
      id: 'cat_valves',
      key: 'valves',
      slug: 'valves',
      name: 'Valves',
      parentId: null,
      description: '',
      icon: 'Waves',
      productCount: 10,
      featured: true,
      sortOrder: 0,
    },
    subcategory: null,
    brand: {
      id: 'brand_vantek',
      key: 'vantek',
      slug: 'vantek',
      name: 'Vantek',
      country: 'India',
      description: '',
      productCount: 5,
    },
    seller: {
      id: 'seller_metro-industrial',
      key: 'metro',
      name: 'Metro',
      city: 'Mumbai',
      state: 'MH',
      gstin: '27AABCM4471K1Z8',
      verified: true,
      fulfilmentRate: 0.95,
      responseHours: 4,
      since: 2011,
    },
    ...overrides,
  }
}

function intent(overrides: Partial<SearchIntent> = {}): SearchIntent {
  return {
    rawQuery: 'stainless threaded valve',
    normalizedQuery: 'stainless threaded valve',
    categoryKeys: ['valves'],
    brandKeys: [],
    specs: [],
    price: {},
    applications: [],
    industries: [],
    quantity: null,
    requiresInStock: false,
    keywords: [],
    excludedTerms: [],
    excludedSpecs: [],
    confidence: 0.9,
    missingCriticalFields: [],
    source: 'offline',
    ...overrides,
  }
}

const context = { semantic: 0.5, lexical: 0.5, categoryKey: 'valves', maxViews: 1000, maxRfqs: 100 }

describe('weights', () => {
  it('base weights sum to 1', () => {
    const total = Object.values(BASE_WEIGHTS).reduce((sum, value) => sum + value, 0)
    expect(total).toBeCloseTo(1, 6)
  })

  it('a category override is renormalised back to 1', () => {
    for (const key of ['electrical', 'fire-fighting', 'pumps', 'safety', 'tools']) {
      const total = Object.values(weightsFor(key)).reduce((sum, value) => sum + value, 0)
      expect(total).toBeCloseTo(1, 6)
    }
  })

  it('an unknown category falls back to the base model', () => {
    expect(weightsFor('nonsense')).toEqual(BASE_WEIGHTS)
    expect(weightsFor(null)).toEqual(BASE_WEIGHTS)
  })

  it('specification match dominates in a compliance category', () => {
    expect(weightsFor('fire-fighting').specMatch).toBeGreaterThan(BASE_WEIGHTS.specMatch)
  })
})

describe('toMatchPercent', () => {
  it('never reaches 100 — a claim the catalogue cannot support', () => {
    expect(toMatchPercent(1)).toBeLessThanOrEqual(MAX_DISPLAY_PERCENT)
    expect(toMatchPercent(999)).toBe(MAX_DISPLAY_PERCENT)
  })

  it('never drops below the display floor', () => {
    expect(toMatchPercent(0)).toBe(MIN_DISPLAY_PERCENT)
    expect(toMatchPercent(-1)).toBe(MIN_DISPLAY_PERCENT)
  })

  it('is monotonic', () => {
    let previous = 0
    for (let score = 0; score <= 1; score += 0.05) {
      const percent = toMatchPercent(score)
      expect(percent).toBeGreaterThanOrEqual(previous)
      previous = percent
    }
  })

  it('maps the relevance floor to the display floor', () => {
    expect(toMatchPercent(RELEVANCE_FLOOR)).toBe(MIN_DISPLAY_PERCENT)
  })
})

describe('scoreProduct', () => {
  it('is deterministic', () => {
    const a = scoreProduct(product(), intent(), context)
    const b = scoreProduct(product(), intent(), context)
    expect(a.score).toBe(b.score)
    expect(a.explanation.matchPercent).toBe(b.explanation.matchPercent)
  })

  it('produces a score inside 0..1', () => {
    const { score } = scoreProduct(product(), intent(), context)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('scores an exact specification match above a mismatch', () => {
    const request = intent({
      specs: [{ key: 'material', values: ['stainless_steel'] }],
    })

    const exact = scoreProduct(product(), request, context)
    const wrong = scoreProduct(
      product({
        specs: [{ key: 'material', valueText: 'upvc', displayValue: 'uPVC' }],
      }),
      request,
      context
    )

    expect(exact.score).toBeGreaterThan(wrong.score)
  })

  it('gives partial credit to a documented substitute', () => {
    const request = intent({ specs: [{ key: 'material', values: ['stainless_steel'] }] })

    const bronze = scoreProduct(
      product({ specs: [{ key: 'material', valueText: 'bronze', displayValue: 'Bronze' }] }),
      request,
      context
    )
    const plastic = scoreProduct(
      product({ specs: [{ key: 'material', valueText: 'upvc', displayValue: 'uPVC' }] }),
      request,
      context
    )

    expect(bronze.score).toBeGreaterThan(plastic.score)

    const criterion = bronze.explanation.criteria.find((c) => c.key === 'material')
    expect(criterion?.status).toBe('partial')
  })

  it('marks a miss as a miss, never as a match', () => {
    const result = scoreProduct(
      product({ specs: [{ key: 'material', valueText: 'brass', displayValue: 'Brass' }] }),
      intent({ specs: [{ key: 'material', values: ['stainless_steel'] }] }),
      context
    )

    const criterion = result.explanation.criteria.find((c) => c.key === 'material')
    expect(criterion?.status).toBe('miss')
    expect(criterion?.actual).toBe('Brass')
  })

  it('reports an unpublished spec as unknown, not as a miss', () => {
    const result = scoreProduct(
      product({ specs: [] }),
      intent({ specs: [{ key: 'material', values: ['stainless_steel'] }] }),
      context
    )

    expect(result.explanation.criteria.find((c) => c.key === 'material')?.status).toBe('unknown')
  })

  it('zeroes price fit well above a stated maximum', () => {
    const result = scoreProduct(
      product({ price: 50_000 }),
      intent({ price: { max: 5_000 } }),
      context
    )

    const component = result.explanation.components.find((c) => c.key === 'priceFit')
    expect(component?.raw).toBe(0)
    expect(result.explanation.criteria.find((c) => c.key === 'price')?.status).toBe('miss')
  })

  it('gives partial credit to a small overshoot and names it', () => {
    const result = scoreProduct(
      product({ price: 5_400 }),
      intent({ price: { max: 5_000 } }),
      context
    )

    const criterion = result.explanation.criteria.find((c) => c.key === 'price')
    expect(criterion?.status).toBe('partial')
    expect(criterion?.note).toMatch(/over your budget/)
  })

  it('ranks ready stock above made to order, all else equal', () => {
    const inStock = scoreProduct(product(), intent(), context)
    const madeToOrder = scoreProduct(
      product({
        availability: {
          state: 'made_to_order',
          quantityOnHand: null,
          leadTimeDays: 30,
          minOrderQuantity: 1,
          unit: 'unit',
        },
      }),
      intent(),
      context
    )

    expect(inStock.score).toBeGreaterThan(madeToOrder.score)
  })

  it('treats popularity as a tiebreaker, not a driver', () => {
    const popular = scoreProduct(
      product({ metrics: { views: 100_000, rfqs: 5_000, saves: 0 } }),
      intent({ specs: [{ key: 'material', values: ['stainless_steel'] }] }),
      { ...context, maxViews: 100_000, maxRfqs: 5_000 }
    )
    const correctButUnpopular = scoreProduct(
      product({ metrics: { views: 1, rfqs: 0, saves: 0 } }),
      intent({ specs: [{ key: 'material', values: ['stainless_steel'] }] }),
      { ...context, maxViews: 100_000, maxRfqs: 5_000 }
    )

    // Both match the spec; popularity may separate them but only slightly.
    expect(popular.score - correctButUnpopular.score).toBeLessThan(BASE_WEIGHTS.popularity + 0.001)
  })

  it('component weights sum to 1 and contributions sum to the score', () => {
    const { score, explanation } = scoreProduct(product(), intent(), context)

    const weightTotal = explanation.components.reduce((sum, c) => sum + c.weight, 0)
    const contributionTotal = explanation.components.reduce((sum, c) => sum + c.weighted, 0)

    expect(weightTotal).toBeCloseTo(1, 6)
    expect(contributionTotal).toBeCloseTo(score, 10)
  })

  it('writes a headline that counts only criteria it could evaluate', () => {
    const result = scoreProduct(
      product(),
      intent({
        specs: [
          { key: 'material', values: ['stainless_steel'] },
          { key: 'connection_type', values: ['threaded'] },
        ],
      }),
      context
    )

    expect(result.explanation.headline).toMatch(/all 2 of your requirements/i)
  })

  it('never claims a failing criterion is met in the summary', () => {
    const result = scoreProduct(
      product({ specs: [{ key: 'material', valueText: 'brass', displayValue: 'Brass' }] }),
      intent({ specs: [{ key: 'material', values: ['stainless_steel'] }] }),
      context
    )

    expect(result.explanation.summary).toMatch(/does not match/i)
    expect(result.explanation.summary).not.toMatch(/Meets your requirement for material/i)
  })
})
