import { describe, expect, it } from 'vitest'
import { cosineSimilarity, embed, EMBEDDING_DIM, VectorIndex } from '@/server/catalog/vector'
import { tokenize } from '@/server/catalog/text'

const vec = (text: string) => embed(tokenize(text))

describe('embed', () => {
  it('produces a fixed-width vector', () => {
    expect(vec('stainless steel valve')).toHaveLength(EMBEDDING_DIM)
  })

  it('is unit length, so cosine reduces to a dot product', () => {
    const vector = vec('stainless steel ball valve threaded')
    const magnitude = Math.sqrt(
      [...vector].reduce((sum, value) => sum + value * value, 0)
    )
    expect(magnitude).toBeCloseTo(1, 5)
  })

  it('is deterministic — the same text always embeds identically', () => {
    expect([...vec('DN50 threaded valve')]).toEqual([...vec('DN50 threaded valve')])
  })

  it('returns a zero vector for empty input rather than throwing', () => {
    const empty = embed([])
    expect(empty).toHaveLength(EMBEDDING_DIM)
    expect([...empty].every((value) => value === 0)).toBe(true)
  })
})

describe('cosineSimilarity', () => {
  it('scores a vector against itself as 1', () => {
    const vector = vec('stainless steel ball valve')
    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1, 5)
  })

  it('is bounded to 0..1 — floating point cannot push it past the range', () => {
    const a = vec('stainless steel ball valve threaded DN50 HVAC')
    const b = vec('circuit breaker MCCB 100A three pole')
    const score = cosineSimilarity(a, b)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  it('rates related text above unrelated text', () => {
    const query = vec('stainless steel ball valve')
    const related = vec('stainless steel ball valve threaded DN50')
    const unrelated = vec('cut resistant gloves EN388 size large')

    expect(cosineSimilarity(query, related)).toBeGreaterThan(
      cosineSimilarity(query, unrelated)
    )
  })

  it('is symmetric', () => {
    const a = vec('pressure gauge bourdon')
    const b = vec('pressure transmitter 4-20mA')
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10)
  })

  it('tolerates a misspelling through character trigrams', () => {
    const correct = vec('stainless')
    const typo = vec('stainles')
    const wrong = vec('breaker')
    expect(cosineSimilarity(correct, typo)).toBeGreaterThan(
      cosineSimilarity(correct, wrong)
    )
  })
})

describe('VectorIndex', () => {
  const index = new VectorIndex()
  index.add('valve', vec('stainless steel ball valve threaded'))
  index.add('breaker', vec('MCCB circuit breaker 100A three pole'))
  index.add('gauge', vec('pressure gauge bourdon 100mm dial'))

  it('reports its size', () => {
    expect(index.size).toBe(3)
  })

  it('scores every entry', () => {
    expect(index.search(vec('valve')).size).toBe(3)
  })

  it('ranks the matching entry first', () => {
    const scores = index.search(vec('ball valve threaded stainless'))
    const ordered = [...scores.entries()].sort((a, b) => b[1] - a[1])
    expect(ordered[0]?.[0]).toBe('valve')
  })

  it('honours a candidate restriction', () => {
    const scores = index.search(vec('valve'), new Set(['gauge']))
    expect([...scores.keys()]).toEqual(['gauge'])
  })

  it('returns the stored vector by id', () => {
    expect(index.get('valve')).toHaveLength(EMBEDDING_DIM)
    expect(index.get('missing')).toBeUndefined()
  })
})
