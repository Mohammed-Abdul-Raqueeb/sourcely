import { describe, expect, it } from 'vitest'
import {
  AVAILABILITY_STATES_ORDER,
  discountPercent,
  formatCompactINR,
  formatDate,
  formatLeadTime,
  formatPrice,
  formatPriceBand,
  formatRelative,
  formatWarranty,
  initials,
  matchBand,
  pluralize,
  RFQ_TONE,
  truncate,
} from '@/lib/format'
import {
  activeFilterCount,
  catalogHref,
  clearFilters,
  hasActiveFilters,
  parseCatalogParams,
  setPrice,
  setSpecRange,
  toggleAvailability,
  toggleListValue,
  toggleSpecValue,
  toSearchParams,
} from '@/lib/catalog-params'
import { MAX_COMPARE, MIN_COMPARE } from '@/lib/compare'
import { RFQ_STATUSES } from '@/lib/domain/account'

describe('currency formatting', () => {
  it('formats whole rupees with Indian grouping', () => {
    expect(formatPrice(3820)).toBe('₹3,820')
    expect(formatPrice(257460)).toBe('₹2,57,460')
  })

  it('compacts using lakh and crore, not thousands-of-thousands', () => {
    expect(formatCompactINR(5000)).toBe('₹5K')
    expect(formatCompactINR(250000)).toBe('₹2.5L')
    expect(formatCompactINR(15000000)).toBe('₹1.5Cr')
    expect(formatCompactINR(500)).toBe('₹500')
  })

  it('describes a price band in the buyer’s terms', () => {
    expect(formatPriceBand(3000, 5000)).toBe('₹3,000 – ₹5,000')
    expect(formatPriceBand(undefined, 5000)).toBe('Under ₹5,000')
    expect(formatPriceBand(3000, undefined)).toBe('Over ₹3,000')
    expect(formatPriceBand()).toBe('Any price')
  })

  it('badges a discount only when it is meaningful', () => {
    expect(discountPercent(3820, 4450)).toBe(14)
    // Under 3% is noise.
    expect(discountPercent(4400, 4450)).toBeNull()
    expect(discountPercent(4450, 4450)).toBeNull()
    expect(discountPercent(4450, null)).toBeNull()
  })
})

describe('catalogue vocabulary', () => {
  it('orders availability worst to best', () => {
    expect(AVAILABILITY_STATES_ORDER.indexOf('in_stock')).toBeGreaterThan(
      AVAILABILITY_STATES_ORDER.indexOf('out_of_stock')
    )
  })

  it('has a tone for every RFQ status', () => {
    for (const status of RFQ_STATUSES) {
      expect(RFQ_TONE[status]).toBeTruthy()
    }
  })

  it('marks only "quoted" with the action colour', () => {
    expect(RFQ_TONE.quoted).toBe('accent')
    expect(RFQ_TONE.submitted).not.toBe('accent')
  })

  it('formats lead times and warranties readably', () => {
    expect(formatLeadTime(0)).toBe('Ships today')
    expect(formatLeadTime(1)).toBe('Ships in 1 day')
    expect(formatLeadTime(21)).toBe('Ships in 3 weeks')
    expect(formatWarranty(24)).toBe('2 years')
    expect(formatWarranty(18)).toBe('18 months')
    expect(formatWarranty(0)).toBe('No warranty')
  })
})

describe('match banding', () => {
  it('is coarse — 91 and 93 must not look different', () => {
    expect(matchBand(91)).toBe(matchBand(93))
  })

  it('separates the bands at the documented thresholds', () => {
    expect(matchBand(85)).toBe('excellent')
    expect(matchBand(84)).toBe('strong')
    expect(matchBand(70)).toBe('strong')
    expect(matchBand(69)).toBe('fair')
  })
})

describe('text helpers', () => {
  it('truncates with an ellipsis and never exceeds the limit', () => {
    expect(truncate('short', 20)).toBe('short')
    expect(truncate('a'.repeat(50), 10)).toHaveLength(10)
  })

  it('pluralises with Indian grouping', () => {
    expect(pluralize(1, 'product')).toBe('1 product')
    expect(pluralize(2, 'product')).toBe('2 products')
    expect(pluralize(100000, 'product')).toBe('1,00,000 products')
  })

  it('builds initials safely', () => {
    expect(initials('Rajesh Kumar')).toBe('RK')
    expect(initials('Priya')).toBe('P')
    expect(initials('   ')).toBe('?')
  })

  it('formats relative time against an explicit now, so it is testable', () => {
    const now = Date.parse('2026-08-23T12:00:00.000Z')
    expect(formatRelative('2026-08-23T11:00:00.000Z', now)).toBe('1h ago')
    expect(formatRelative('2026-08-20T12:00:00.000Z', now)).toBe('3d ago')
  })

  it('formats dates in en-IN regardless of ambient locale', () => {
    expect(formatDate('2026-08-23T00:00:00.000Z')).toMatch(/23 Aug 2026/)
  })
})

describe('catalog params', () => {
  it('round-trips a full query', () => {
    const params = parseCatalogParams({
      q: 'valve',
      cat: 'valves,pumps',
      brand: 'vantek',
      avail: 'in_stock',
      min: '1000',
      max: '5000',
      sort: 'price_asc',
      view: 'list',
      s_material: 'stainless_steel,bronze',
      s_size_dn: '40:65',
    })

    expect(params.text).toBe('valve')
    expect(params.categoryKeys).toEqual(['valves', 'pumps'])
    expect(params.price).toEqual({ min: 1000, max: 5000 })
    expect(params.view).toBe('list')
    expect(params.specs).toContainEqual({ key: 'material', values: ['stainless_steel', 'bronze'] })
    expect(params.specs).toContainEqual({ key: 'size_dn', min: 40, max: 65 })

    const serialised = toSearchParams(params)
    expect(serialised.get('cat')).toBe('valves,pumps')
    expect(serialised.get('s_material')).toBe('stainless_steel,bronze')
    expect(serialised.get('s_size_dn')).toBe('40:65')
  })

  it('omits defaults so a clean URL stays clean', () => {
    expect(catalogHref({ view: 'grid', sort: 'popular' })).toBe('/products')
  })

  it('rejects an invalid sort key rather than trusting it', () => {
    const params = parseCatalogParams({ sort: 'DROP TABLE' })
    expect(params.sort).toBe('popular')
  })

  it('ignores an unknown availability state', () => {
    expect(parseCatalogParams({ avail: 'teleported' }).availability).toBeUndefined()
  })

  it('ignores a negative price', () => {
    expect(parseCatalogParams({ min: '-500' }).price).toBeUndefined()
  })

  it('clears the cursor on every filter change', () => {
    const withCursor = { ...parseCatalogParams({ cursor: 'abc' }), cursor: 'abc' }
    expect(toggleListValue(withCursor, 'brandKeys', 'vantek').cursor).toBeUndefined()
    expect(toggleSpecValue(withCursor, 'material', 'brass').cursor).toBeUndefined()
    expect(setPrice(withCursor, 100, 200).cursor).toBeUndefined()
  })

  it('toggles a value off when it is already selected', () => {
    const on = toggleListValue(parseCatalogParams({}), 'brandKeys', 'vantek')
    expect(on.brandKeys).toEqual(['vantek'])
    expect(toggleListValue(on, 'brandKeys', 'vantek').brandKeys).toBeUndefined()
  })

  it('drops a spec constraint when its last value is removed', () => {
    const on = toggleSpecValue(parseCatalogParams({}), 'material', 'brass')
    expect(toggleSpecValue(on, 'material', 'brass').specs).toBeUndefined()
  })

  it('keeps the search text when filters are cleared', () => {
    const params = parseCatalogParams({ q: 'valve', cat: 'valves', min: '100' })
    const cleared = clearFilters(params)
    expect(cleared.text).toBe('valve')
    expect(cleared.categoryKeys).toBeUndefined()
    expect(hasActiveFilters(cleared)).toBe(false)
  })

  it('counts active filters including each enum value', () => {
    const params = parseCatalogParams({
      cat: 'valves',
      s_material: 'stainless_steel,brass',
      max: '5000',
    })
    expect(activeFilterCount(params)).toBe(4)
  })

  it('removes a range constraint when both bounds are cleared', () => {
    const withRange = setSpecRange(parseCatalogParams({}), 'size_dn', 40, 65)
    expect(setSpecRange(withRange, 'size_dn', null, null).specs).toBeUndefined()
  })

  it('handles array-valued params from Next without throwing', () => {
    expect(parseCatalogParams({ q: ['valve', 'pump'] }).text).toBe('valve')
  })

  it('toggles availability', () => {
    const on = toggleAvailability(parseCatalogParams({}), 'in_stock')
    expect(on.availability).toEqual(['in_stock'])
    expect(toggleAvailability(on, 'in_stock').availability).toBeUndefined()
  })
})

describe('comparison constants', () => {
  it('is a plain number in a Server Component, not a client-reference proxy', () => {
    // Regression guard: MAX_COMPARE once lived in a 'use client' module, and a
    // Server Component reading it got an object. `slice(0, object)` coerces to
    // NaN, which truncates to zero — a silent empty comparison with no error.
    expect(typeof MAX_COMPARE).toBe('number')
    expect(typeof MIN_COMPARE).toBe('number')
    expect([1, 2, 3, 4, 5].slice(0, MAX_COMPARE)).toHaveLength(4)
  })

  it('requires at least two products to be a comparison', () => {
    expect(MIN_COMPARE).toBe(2)
    expect(MAX_COMPARE).toBeGreaterThan(MIN_COMPARE)
  })
})
