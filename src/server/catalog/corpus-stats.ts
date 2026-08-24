import { tokenize } from './text'

/**
 * Catalogue-wide statistics that scoring must not derive from the candidate
 * pool.
 *
 * A match percentage is a claim about one product against one requirement. It
 * has to mean the same thing wherever it is shown, so none of its inputs may
 * depend on which *other* products happened to be retrieved alongside it.
 *
 * Three of the eight scoring components break that rule if left to their own
 * devices:
 *
 *   - BM25 IDF divides by document frequency over the indexed corpus.
 *   - BM25 length normalisation divides by the corpus mean document length.
 *   - The demand component divides by the highest view and RFQ counts seen.
 *
 * The memory driver never noticed, because its index *is* the whole catalogue.
 * The Postgres driver constrains in SQL and ranks the survivors, so its index
 * is a different corpus on every query — and the same product came out at 95%
 * under one driver and 94% under the other. Injecting one shared snapshot is
 * the fix, and it is the same idea as Elasticsearch's `dfs_query_then_fetch`:
 * gather global term statistics first, score locally against them.
 */
export interface CorpusStats {
  /** Active products in the catalogue — the `N` in the IDF numerator. */
  totalDocuments: number
  /** Mean token count per document, for BM25 length normalisation. */
  averageDocumentLength: number
  /** term -> how many documents contain it, catalogue-wide. */
  documentFrequency: ReadonlyMap<string, number>
  /** Highest view count in the catalogue, for the demand component. */
  maxViews: number
  /** Highest RFQ count in the catalogue, for the demand component. */
  maxRfqs: number
}

export interface CorpusDocument {
  text: string
  views: number
  rfqs: number
}

/**
 * Folds a full pass over the catalogue into one statistics snapshot.
 *
 * Only term *presence* is retained, not per-document frequencies or postings —
 * a few hundred KB for a catalogue in the hundreds of thousands, which is what
 * makes caching it per process affordable.
 */
export function computeCorpusStats(documents: Iterable<CorpusDocument>): CorpusStats {
  const documentFrequency = new Map<string, number>()
  let totalDocuments = 0
  let totalLength = 0
  let maxViews = 1
  let maxRfqs = 1

  for (const document of documents) {
    const tokens = tokenize(document.text)
    totalDocuments += 1
    totalLength += tokens.length

    // A term counts once per document however often it appears in it.
    for (const term of new Set(tokens)) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
    }

    if (document.views > maxViews) maxViews = document.views
    if (document.rfqs > maxRfqs) maxRfqs = document.rfqs
  }

  return {
    totalDocuments,
    averageDocumentLength: totalDocuments > 0 ? totalLength / totalDocuments : 0,
    documentFrequency,
    maxViews,
    maxRfqs,
  }
}

/**
 * A process-local snapshot with a time-to-live.
 *
 * Corpus statistics move slowly — one product added to sixty thousand shifts
 * no IDF meaningfully — so a short TTL costs nothing in accuracy and removes a
 * full catalogue scan from the hot path. `invalidate()` is called on catalogue
 * writes so an admin sees their own edit reflected immediately rather than
 * after the timer.
 */
export class CorpusStatsCache {
  private snapshot: CorpusStats | null = null
  private expiresAt = 0
  private inFlight: Promise<CorpusStats> | null = null

  constructor(
    private readonly load: () => Promise<CorpusStats>,
    private readonly ttlMs = 60_000,
    private readonly now: () => number = () => Date.now()
  ) {}

  async get(): Promise<CorpusStats> {
    if (this.snapshot && this.now() < this.expiresAt) return this.snapshot

    // Concurrent misses share one load. Without this, a cold cache under load
    // starts a full catalogue scan per in-flight request.
    this.inFlight ??= this.load()
      .then((stats) => {
        this.snapshot = stats
        this.expiresAt = this.now() + this.ttlMs
        return stats
      })
      .finally(() => {
        this.inFlight = null
      })

    return this.inFlight
  }

  invalidate(): void {
    this.expiresAt = 0
  }
}
