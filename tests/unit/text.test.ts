import { describe, expect, it } from 'vitest'
import {
  BM25Index,
  normalize,
  normalizeScores,
  reciprocalRankFusion,
  tokenize,
} from '@/server/catalog/text'

describe('normalize', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalize('  Stainless   STEEL  ')).toBe('stainless steel')
  })

  it('strips Indian digit grouping so ₹5,000 is one number', () => {
    expect(normalize('under ₹5,000')).toContain('5000')
    expect(normalize('₹1,25,000')).toContain('25000')
  })

  it('normalises curly quotes and dashes', () => {
    expect(normalize('“2” valve — threaded')).toBe('2 valve - threaded')
  })

  it('is idempotent', () => {
    const once = normalize('  ₹5,000  “SS316”  ')
    expect(normalize(once)).toBe(once)
  })
})

describe('tokenize', () => {
  it('preserves alphanumeric trade notation', () => {
    expect(tokenize('SS316 DN50 PN16')).toEqual(
      expect.arrayContaining(['ss316', 'dn50', 'pn16'])
    )
  })

  it('also emits the halves of a compound so "316 stainless" reaches SS316', () => {
    const tokens = tokenize('ss316')
    expect(tokens).toContain('ss316')
    expect(tokens).toContain('ss')
    expect(tokens).toContain('316')
  })

  it('drops stop words but keeps short technical terms', () => {
    const tokens = tokenize('I need a valve for the ss line')
    expect(tokens).not.toContain('the')
    expect(tokens).not.toContain('need')
    expect(tokens).toContain('valve')
    expect(tokens).toContain('ss')
  })

  it('returns nothing for a query made only of stop words', () => {
    expect(tokenize('I need a the for')).toEqual([])
  })

  it('handles empty and whitespace input without throwing', () => {
    expect(tokenize('')).toEqual([])
    expect(tokenize('     ')).toEqual([])
  })
})

describe('BM25Index', () => {
  const documents = [
    { id: 'a', text: 'stainless steel ball valve threaded DN50' },
    { id: 'b', text: 'brass ball valve threaded DN50' },
    { id: 'c', text: 'cast iron butterfly valve wafer DN100' },
    { id: 'd', text: 'circuit breaker MCCB 100A three pole' },
  ]

  const index = new BM25Index(documents)

  it('indexes every document', () => {
    expect(index.size).toBe(4)
  })

  it('scores only documents containing a query term', () => {
    const scores = index.search('mccb')
    expect([...scores.keys()]).toEqual(['d'])
  })

  it('ranks the more specific document higher', () => {
    const scores = index.search('stainless steel ball valve')
    const ordered = [...scores.entries()].sort((x, y) => y[1] - x[1])
    expect(ordered[0]?.[0]).toBe('a')
  })

  it('returns nothing for a term that appears nowhere', () => {
    expect(index.search('titanium').size).toBe(0)
  })

  it('returns nothing for an empty query', () => {
    expect(index.search('').size).toBe(0)
  })

  it('honours a candidate restriction', () => {
    const scores = index.search('valve', new Set(['c']))
    expect([...scores.keys()]).toEqual(['c'])
  })

  it('gives a rarer term more weight than a common one', () => {
    // "valve" appears in three documents; "mccb" in one. The rare term should
    // produce the larger single-document score.
    const common = index.search('valve').get('a') ?? 0
    const rare = index.search('mccb').get('d') ?? 0
    expect(rare).toBeGreaterThan(common)
  })
})

describe('normalizeScores', () => {
  it('scales to 0..1 against the maximum', () => {
    const scaled = normalizeScores(new Map([['a', 5], ['b', 10]]))
    expect(scaled.get('b')).toBe(1)
    expect(scaled.get('a')).toBe(0.5)
  })

  it('leaves an all-zero map alone rather than dividing by zero', () => {
    const scaled = normalizeScores(new Map([['a', 0]]))
    expect(scaled.get('a')).toBe(0)
  })

  it('handles an empty map', () => {
    expect(normalizeScores(new Map()).size).toBe(0)
  })
})

describe('reciprocalRankFusion', () => {
  it('rewards a document ranked highly by both inputs', () => {
    const lexical = new Map([['a', 10], ['b', 5], ['c', 1]])
    const vector = new Map([['a', 0.9], ['c', 0.8], ['b', 0.1]])

    const fused = reciprocalRankFusion([lexical, vector])
    const ordered = [...fused.entries()].sort((x, y) => y[1] - x[1])

    expect(ordered[0]?.[0]).toBe('a')
  })

  it('combines rankings that share no documents', () => {
    const fused = reciprocalRankFusion([new Map([['a', 1]]), new Map([['b', 1]])])
    expect(fused.size).toBe(2)
  })

  it('is scale-invariant — only rank position matters', () => {
    const small = reciprocalRankFusion([new Map([['a', 0.001], ['b', 0.0005]])])
    const large = reciprocalRankFusion([new Map([['a', 1000], ['b', 500]])])
    expect(small.get('a')).toBe(large.get('a'))
  })
})
