import { describe, expect, it, vi } from 'vitest'
import { CorpusStatsCache, computeCorpusStats } from '@/server/catalog/corpus-stats'
import { BM25Index } from '@/server/catalog/text'

const doc = (text: string, views = 0, rfqs = 0) => ({ text, views, rfqs })

describe('computeCorpusStats', () => {
  it('counts a term once per document however often it appears', () => {
    const stats = computeCorpusStats([
      doc('valve valve valve valve'),
      doc('valve pump'),
      doc('pump gauge'),
    ])

    expect(stats.totalDocuments).toBe(3)
    expect(stats.documentFrequency.get('valve')).toBe(2)
    expect(stats.documentFrequency.get('pump')).toBe(2)
    expect(stats.documentFrequency.get('gauge')).toBe(1)
  })

  it('averages document length over tokens, not characters', () => {
    // "a" and "the" are stopped, so these are 2 and 4 tokens.
    const stats = computeCorpusStats([doc('valve pump'), doc('valve pump gauge sensor')])
    expect(stats.averageDocumentLength).toBe(3)
  })

  it('takes the maxima across the whole catalogue', () => {
    const stats = computeCorpusStats([doc('a', 10, 2), doc('b', 400, 1), doc('c', 3, 55)])
    expect(stats.maxViews).toBe(400)
    expect(stats.maxRfqs).toBe(55)
  })

  it('floors the maxima at one so the demand component never divides by zero', () => {
    const stats = computeCorpusStats([doc('valve', 0, 0)])
    expect(stats.maxViews).toBe(1)
    expect(stats.maxRfqs).toBe(1)
  })

  it('handles an empty catalogue without producing NaN', () => {
    const stats = computeCorpusStats([])
    expect(stats.totalDocuments).toBe(0)
    expect(stats.averageDocumentLength).toBe(0)
    expect(Number.isNaN(stats.averageDocumentLength)).toBe(false)
  })
})

describe('BM25 with injected corpus statistics', () => {
  /**
   * The property that matters: a document scores the same whether it is
   * indexed with the whole catalogue or alone with the catalogue's statistics.
   * Without it, the Postgres driver — which indexes only the rows its SQL
   * constrain returned — reports a different match percentage from the memory
   * driver for the same product and the same query.
   */
  const catalogue = [
    { id: 'a', text: 'stainless steel ball valve dn50 threaded' },
    { id: 'b', text: 'brass ball valve dn50 flanged' },
    { id: 'c', text: 'cast iron gate valve dn80 flanged' },
    { id: 'd', text: 'pressure gauge 0-16 bar stainless steel' },
    { id: 'e', text: 'stainless steel butterfly valve dn100 wafer' },
  ]

  const stats = computeCorpusStats(catalogue.map((entry) => doc(entry.text)))
  const global = {
    totalDocuments: stats.totalDocuments,
    averageDocumentLength: stats.averageDocumentLength,
    documentFrequency: stats.documentFrequency,
  }

  it('scores a document identically whether indexed whole or as a slice', () => {
    const whole = new BM25Index(catalogue).search('stainless steel ball valve')
    const slice = new BM25Index([catalogue[0]!, catalogue[1]!], global).search(
      'stainless steel ball valve'
    )

    expect(slice.get('a')).toBeCloseTo(whole.get('a')!, 10)
  })

  it('diverges without the statistics — which is the bug being guarded', () => {
    const whole = new BM25Index(catalogue).search('stainless steel ball valve')
    const slice = new BM25Index([catalogue[0]!, catalogue[1]!]).search('stainless steel ball valve')

    expect(slice.get('a')).not.toBeCloseTo(whole.get('a')!, 4)
  })

  it('preserves relative order within the slice', () => {
    const index = new BM25Index([catalogue[0]!, catalogue[1]!, catalogue[2]!], global)
    const scores = index.search('stainless steel ball valve')

    expect(scores.get('a')!).toBeGreaterThan(scores.get('b')!)
    expect(scores.get('b')!).toBeGreaterThan(scores.get('c') ?? 0)
  })

  it('ignores a term the slice does not contain, however rare it is globally', () => {
    const scores = new BM25Index([catalogue[3]!], global).search('butterfly')
    expect(scores.size).toBe(0)
  })

  it('clamps a stale snapshot rather than producing a negative IDF', () => {
    // Snapshot taken when the catalogue was smaller than the slice being scored.
    const stale = { totalDocuments: 1, averageDocumentLength: 6, documentFrequency: new Map() }
    const scores = new BM25Index(catalogue, stale).search('valve')

    for (const score of scores.values()) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(score)).toBe(true)
    }
  })
})

describe('CorpusStatsCache', () => {
  const stats = () => computeCorpusStats([doc('valve')])

  it('loads once and serves the snapshot until the TTL lapses', async () => {
    let now = 1_000
    const load = vi.fn(async () => stats())
    const cache = new CorpusStatsCache(load, 60_000, () => now)

    await cache.get()
    await cache.get()
    expect(load).toHaveBeenCalledTimes(1)

    now += 59_000
    await cache.get()
    expect(load).toHaveBeenCalledTimes(1)

    now += 2_000
    await cache.get()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('collapses concurrent misses into a single load', async () => {
    const load = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      return stats()
    })
    const cache = new CorpusStatsCache(load, 60_000, () => 0)

    await Promise.all([cache.get(), cache.get(), cache.get(), cache.get()])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('reloads on the next read after invalidate', async () => {
    const load = vi.fn(async () => stats())
    const cache = new CorpusStatsCache(load, 60_000, () => 0)

    await cache.get()
    cache.invalidate()
    await cache.get()

    expect(load).toHaveBeenCalledTimes(2)
  })

  it('does not poison the cache when a load fails', async () => {
    let attempt = 0
    const load = vi.fn(async () => {
      attempt += 1
      if (attempt === 1) throw new Error('database unreachable')
      return stats()
    })
    const cache = new CorpusStatsCache(load, 60_000, () => 0)

    await expect(cache.get()).rejects.toThrow('database unreachable')
    // A failed load must not leave an in-flight promise behind, or every
    // subsequent request would await a promise that already rejected.
    await expect(cache.get()).resolves.toMatchObject({ totalDocuments: 1 })
  })
})
