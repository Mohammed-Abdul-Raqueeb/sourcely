/**
 * Lexical retrieval — normalisation, tokenisation and BM25.
 *
 * The Postgres driver replaces this with `tsvector` + GIN and the `ts_rank_cd`
 * ranking function. The scoring contract is identical, so the ranking layer
 * above does not know or care which one produced the candidate list.
 */

/* -------------------------------------------------------------------------- */
/* Normalisation                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Industrial catalogue text is full of notation that a naive tokeniser
 * destroys: `SS316`, `DN50`, `1/2"`, `4–20 mA`, `PN16`, `IP65`. Normalisation
 * has to preserve the alphanumeric runs that carry the meaning while
 * flattening the punctuation around them.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    // Curly quotes and dashes to ASCII before anything else.
    .replace(/[‘’“”]/g, '')
    .replace(/[–—]/g, '-')
    // Indian digit grouping: "₹5,000" -> "₹5000"
    .replace(/(\d),(\d{3})\b/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Very small stop list. Aggressive stopping hurts recall on short queries. */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'from',
  'has', 'have', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'need', 'needed',
  'of', 'on', 'or', 'our', 'that', 'the', 'their', 'this', 'to', 'want',
  'was', 'we', 'were', 'will', 'with', 'would', 'you', 'your', 'please',
  'looking', 'suitable', 'preferably', 'some', 'something', 'any',
])

/**
 * Splits into terms, keeping alphanumeric compounds (`ss316`, `dn50`, `pn16`)
 * intact and additionally emitting their letter/digit halves so a query for
 * "316 stainless" still reaches a product indexed as "SS316".
 */
export function tokenize(text: string): string[] {
  const normalized = normalize(text)
  const raw = normalized.split(/[^a-z0-9./]+/).filter(Boolean)

  const tokens: string[] = []
  for (const term of raw) {
    if (term.length < 2 && !/\d/.test(term)) continue
    if (STOP_WORDS.has(term)) continue

    tokens.push(term)

    // Split alphanumeric compounds: ss316 -> ss, 316 ; dn50 -> dn, 50
    const compound = /^([a-z]+)(\d+(?:\.\d+)?)$/.exec(term)
    if (compound?.[1] && compound[2]) {
      tokens.push(compound[1], compound[2])
    }
  }

  return tokens
}

/* -------------------------------------------------------------------------- */
/* BM25                                                                       */
/* -------------------------------------------------------------------------- */

const K1 = 1.2
const B = 0.75

export interface LexicalDocument {
  id: string
  /** Field-weighted text. Callers repeat high-value fields to boost them. */
  text: string
}

/**
 * Corpus-wide term statistics, supplied when the index holds only a slice of
 * the catalogue. See `CorpusStats` in ./corpus-stats.ts for why these cannot
 * be derived from the slice.
 */
export interface GlobalTermStats {
  totalDocuments: number
  averageDocumentLength: number
  documentFrequency: ReadonlyMap<string, number>
}

export interface LexicalHit {
  id: string
  score: number
}

/**
 * An in-memory BM25 index.
 *
 * Built once when the catalogue loads. At the scale this driver targets
 * (up to a few tens of thousands of products) a full scan of the posting
 * lists is well under a millisecond; beyond that, use the Postgres driver.
 */
export class BM25Index {
  /** term -> docId -> term frequency */
  private readonly postings = new Map<string, Map<string, number>>()
  private readonly docLengths = new Map<string, number>()
  private readonly docIds: string[] = []
  private averageLength = 0

  /**
   * Catalogue-wide statistics, when the indexed documents are only a slice of
   * the catalogue. Without them IDF and length normalisation are computed
   * against whatever subset was passed in, so a product's relevance score
   * would depend on which other products were retrieved alongside it.
   */
  private readonly global: GlobalTermStats | null

  constructor(documents: LexicalDocument[], global: GlobalTermStats | null = null) {
    this.global = global
    let totalLength = 0

    for (const document of documents) {
      const tokens = tokenize(document.text)
      this.docIds.push(document.id)
      this.docLengths.set(document.id, tokens.length)
      totalLength += tokens.length

      const frequencies = new Map<string, number>()
      for (const token of tokens) {
        frequencies.set(token, (frequencies.get(token) ?? 0) + 1)
      }

      for (const [term, frequency] of frequencies) {
        let posting = this.postings.get(term)
        if (!posting) {
          posting = new Map()
          this.postings.set(term, posting)
        }
        posting.set(document.id, frequency)
      }
    }

    this.averageLength = documents.length > 0 ? totalLength / documents.length : 0
  }

  get size(): number {
    return this.docIds.length
  }

  /** Mean document length used for length normalisation. */
  private get avgdl(): number {
    return this.global?.averageDocumentLength ?? this.averageLength
  }

  /** Robertson/Sparck-Jones IDF with the standard +0.5 smoothing. */
  private idf(term: string): number {
    const local = this.postings.get(term)?.size ?? 0
    // A term absent from the indexed slice contributes nothing regardless of
    // how common it is catalogue-wide — there is no document here to score.
    if (local === 0) return 0

    // Global df can only be >= local df. Clamping guards against a stale
    // snapshot taken before these documents existed, which would otherwise
    // produce a negative numerator and a nonsensical IDF.
    const documentFrequency = Math.max(local, this.global?.documentFrequency.get(term) ?? local)
    const n = Math.max(documentFrequency, this.global?.totalDocuments ?? this.docIds.length)

    return Math.log(1 + (n - documentFrequency + 0.5) / (documentFrequency + 0.5))
  }

  /**
   * Scores every document containing at least one query term.
   * `candidateIds`, when supplied, restricts scoring to a pre-filtered set —
   * this is the constrain-then-retrieve order described in ARCHITECTURE.md 3.
   */
  search(query: string, candidateIds?: ReadonlySet<string>): Map<string, number> {
    const terms = tokenize(query)
    const scores = new Map<string, number>()
    if (terms.length === 0) return scores

    // De-duplicate while keeping repeated terms as a frequency multiplier.
    const queryFrequencies = new Map<string, number>()
    for (const term of terms) {
      queryFrequencies.set(term, (queryFrequencies.get(term) ?? 0) + 1)
    }

    for (const [term, queryFrequency] of queryFrequencies) {
      const posting = this.postings.get(term)
      if (!posting) continue

      const idf = this.idf(term)
      if (idf <= 0) continue

      for (const [docId, termFrequency] of posting) {
        if (candidateIds && !candidateIds.has(docId)) continue

        const length = this.docLengths.get(docId) ?? 0
        const denominator =
          termFrequency + K1 * (1 - B + (B * length) / (this.avgdl || 1))
        const contribution = idf * ((termFrequency * (K1 + 1)) / (denominator || 1))

        scores.set(docId, (scores.get(docId) ?? 0) + contribution * queryFrequency)
      }
    }

    return scores
  }
}

/**
 * Normalises a raw score map to 0..1 against its own maximum.
 *
 * BM25 has no upper bound, so an absolute score is meaningless to the ranking
 * model. Only the position within the candidate set carries signal.
 */
export function normalizeScores(scores: Map<string, number>): Map<string, number> {
  let max = 0
  for (const score of scores.values()) {
    if (score > max) max = score
  }
  if (max === 0) return scores

  const normalized = new Map<string, number>()
  for (const [id, score] of scores) {
    normalized.set(id, score / max)
  }
  return normalized
}

/**
 * Reciprocal Rank Fusion. Combines the lexical and vector rankings without
 * needing their scores to be on a comparable scale — the standard fix for
 * hybrid retrieval, and the reason we do not try to tune a mixing constant
 * between BM25 and cosine similarity.
 */
export function reciprocalRankFusion(
  rankings: Map<string, number>[],
  k = 60
): Map<string, number> {
  const fused = new Map<string, number>()

  for (const ranking of rankings) {
    const ordered = [...ranking.entries()].sort((a, b) => b[1] - a[1])
    ordered.forEach(([id], index) => {
      fused.set(id, (fused.get(id) ?? 0) + 1 / (k + index + 1))
    })
  }

  return fused
}
