import { describe, expect, it } from 'vitest'
import { parseIntentOffline } from '@/server/ai/intent-offline'

/**
 * The offline parser is the product's floor: with no API key configured, this
 * is what turns a sentence into a search. These tests pin the behaviours that
 * are easy to regress and expensive to notice.
 */

const specValues = (query: string, key: string) =>
  parseIntentOffline(query).specs.find((constraint) => constraint.key === key)?.values ?? []

describe('price extraction', () => {
  it('reads a ceiling', () => {
    expect(parseIntentOffline('valve under ₹5,000').price.max).toBe(5000)
  })

  it('reads a range, and does not mistake it for a ceiling', () => {
    const price = parseIntentOffline('valve between ₹3,000 and ₹5,000').price
    expect(price.min).toBe(3000)
    expect(price.max).toBe(5000)
  })

  it('reads a floor', () => {
    expect(parseIntentOffline('pump above ₹50,000').price.min).toBe(50000)
  })

  it('understands Indian magnitude words', () => {
    expect(parseIntentOffline('under 5k').price.max).toBe(5000)
    expect(parseIntentOffline('under 2 lakh').price.max).toBe(200000)
    expect(parseIntentOffline('under 1.5 crore').price.max).toBe(15000000)
  })

  it('leaves price unset when none is mentioned', () => {
    const price = parseIntentOffline('stainless ball valve').price
    expect(price.min).toBeUndefined()
    expect(price.max).toBeUndefined()
  })

  it('does not read a pressure rating as money', () => {
    expect(parseIntentOffline('valve rated 16 bar').price.max).toBeUndefined()
  })
})

describe('specification extraction', () => {
  it('maps trade shorthand to canonical material values', () => {
    expect(specValues('SS316 valve', 'material')).toContain('stainless_steel')
    expect(specValues('CI body valve', 'material')).toContain('cast_iron')
    expect(specValues('gunmetal valve', 'material')).toContain('bronze')
  })

  it('reads nominal bore from DN, inches and millimetres', () => {
    const dn = parseIntentOffline('DN50 valve').specs.find((s) => s.key === 'size_dn')
    expect(dn?.min).toBe(50)

    const inch = parseIntentOffline('2 inch valve').specs.find((s) => s.key === 'size_dn')
    expect(inch?.min).toBe(50)
  })

  it('reads electrical units', () => {
    const intent = parseIntentOffline('100A 3 pole MCCB with 25kA breaking capacity')
    const get = (key: string) => intent.specs.find((s) => s.key === key)?.min

    expect(get('current_rating_a')).toBe(100)
    expect(get('breaking_capacity_ka')).toBe(25)
    expect(get('poles')).toBe(3)
  })

  it('does not fire a short synonym inside a longer word', () => {
    // "ac" is an HVAC synonym and sits inside "capacity". A substring match
    // here would tag every breaker query as an HVAC application.
    const intent = parseIntentOffline('MCCB with 25kA breaking capacity')
    expect(intent.applications).not.toContain('hvac')
  })

  it('does not treat "al" inside "metal" as aluminium', () => {
    expect(specValues('sheet metal handling gloves', 'material')).not.toContain('aluminium')
  })
})

describe('category inference', () => {
  it('resolves an explicit product noun', () => {
    expect(parseIntentOffline('ball valve DN50').categoryKeys).toContain('valves')
  })

  it('bridges the vocabulary gap when no product noun is present', () => {
    const intent = parseIntentOffline(
      'I need something to control water flow in a commercial HVAC riser'
    )
    expect(intent.categoryKeys).toContain('valves')
  })

  it('treats a named system as an application, not a category', () => {
    const intent = parseIntentOffline('stainless threaded valve for an HVAC system')
    expect(intent.categoryKeys).toContain('valves')
    expect(intent.categoryKeys).not.toContain('hvac')
    expect(intent.applications).toContain('hvac')
  })

  it('recognises the words buyers actually type', () => {
    expect(parseIntentOffline('cut resistant gloves size L').categoryKeys).toContain('safety')
    expect(parseIntentOffline('pressure gauge 0-16 bar').categoryKeys).toContain('instrumentation')
    expect(parseIntentOffline('pendent sprinklers 68 degree').categoryKeys).toContain('fire-fighting')
  })

  it('infers a category from a spec even without a product noun', () => {
    // K-factor only exists on sprinklers.
    expect(parseIntentOffline('K80 head, 68 °C bulb').categoryKeys).toContain('fire-fighting')
  })
})

describe('negation', () => {
  it('excludes a ruled-out value instead of selecting it', () => {
    const intent = parseIntentOffline('DN50 ball valve, not brass')
    expect(intent.excludedTerms).toContain('brass')
    expect(specValues('DN50 ball valve, not brass', 'material')).not.toContain('brass')
  })

  it('resolves the exclusion to a hard spec filter', () => {
    const intent = parseIntentOffline('valve, no plastic')
    expect(intent.excludedSpecs.length).toBeGreaterThan(0)
    expect(intent.excludedSpecs.every((constraint) => constraint.hard)).toBe(true)
  })

  it('handles several negation phrasings', () => {
    for (const phrase of ['not brass', 'no brass', 'without brass', 'avoid brass']) {
      expect(parseIntentOffline(`valve ${phrase}`).excludedTerms).toContain('brass')
    }
  })
})

describe('quantity, stock and confidence', () => {
  it('reads a quantity', () => {
    expect(parseIntentOffline('50 nos of DN50 ball valve').quantity).toBe(50)
  })

  it('does not read a price as a quantity', () => {
    expect(parseIntentOffline('valve under ₹5,000').quantity).toBeNull()
  })

  it('detects a ready-stock requirement', () => {
    expect(parseIntentOffline('DN50 valve, in stock').requiresInStock).toBe(true)
    expect(parseIntentOffline('DN50 valve').requiresInStock).toBe(false)
  })

  it('reports higher confidence for a fully specified query', () => {
    const vague = parseIntentOffline('I need a valve')
    const precise = parseIntentOffline(
      'SS316 threaded ball valve DN50 for HVAC under ₹5,000'
    )
    expect(precise.confidence).toBeGreaterThan(vague.confidence)
  })

  it('keeps confidence inside 0..1', () => {
    for (const query of ['', 'valve', 'SS316 threaded ball valve DN50 PN63 HVAC ₹5000 50 nos']) {
      const { confidence } = parseIntentOffline(query)
      expect(confidence).toBeGreaterThanOrEqual(0)
      expect(confidence).toBeLessThanOrEqual(1)
    }
  })

  it('lists unanswered critical fields for the follow-up question', () => {
    const intent = parseIntentOffline('I need a valve for HVAC')
    expect(intent.missingCriticalFields.length).toBeGreaterThan(0)
  })

  it('reports itself as the offline source', () => {
    expect(parseIntentOffline('valve').source).toBe('offline')
  })
})

describe('robustness', () => {
  it('handles an empty query without throwing', () => {
    const intent = parseIntentOffline('')
    expect(intent.categoryKeys).toEqual([])
    expect(intent.specs).toEqual([])
  })

  it('handles punctuation-only input', () => {
    expect(() => parseIntentOffline('!!! ??? ...')).not.toThrow()
  })

  it('handles a very long query', () => {
    const long = 'stainless steel threaded ball valve '.repeat(200)
    expect(() => parseIntentOffline(long)).not.toThrow()
  })

  it('is deterministic', () => {
    const query = 'SS316 threaded valve for HVAC under ₹5,000, not brass, 20 nos'
    expect(JSON.stringify(parseIntentOffline(query))).toBe(
      JSON.stringify(parseIntentOffline(query))
    )
  })
})
