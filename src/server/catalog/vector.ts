/**
 * Vector retrieval.
 *
 * With `AI_PROVIDER=claude` this module is swapped for real embeddings stored
 * in a pgvector column. What follows is the offline implementation: a
 * deterministic hashed bag-of-features embedding.
 *
 * It is genuinely a vector space with genuine cosine similarity — not a stub.
 * What it lacks is *semantic generalisation*: it will not learn that "isolate
 * the flow" means "valve" unless that association exists in the synonym
 * registry. Character trigrams give it tolerance to misspelling and inflection,
 * which covers most of the practical gap for a specification catalogue.
 */

export const EMBEDDING_DIM = 256

/** FNV-1a, seeded per feature namespace so word and trigram spaces differ. */
function hashFeature(feature: string, seed: number): number {
  let h = seed >>> 0
  for (let i = 0; i < feature.length; i++) {
    h ^= feature.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function trigrams(term: string): string[] {
  const padded = `  ${term} `
  const grams: string[] = []
  for (let i = 0; i < padded.length - 2; i++) {
    grams.push(padded.slice(i, i + 3))
  }
  return grams
}

/**
 * Builds a unit-length embedding from tokens.
 *
 * Two feature families are hashed into the same space:
 *   - whole tokens, at full weight — carries exact terminology
 *   - character trigrams, at low weight — carries fuzzy similarity
 *
 * Signed hashing (the low bit selects the sign) keeps the expected dot product
 * of unrelated features near zero, which is what stops a 256-dimension space
 * from saturating.
 */
export function embed(tokens: string[]): Float32Array {
  const vector = new Float32Array(EMBEDDING_DIM)
  if (tokens.length === 0) return vector

  for (const token of tokens) {
    const wordHash = hashFeature(token, 0x811c9dc5)
    const index = wordHash % EMBEDDING_DIM
    const sign = (wordHash & 1) === 0 ? 1 : -1
    vector[index] = (vector[index] ?? 0) + sign * 1.0

    // Trigrams are down-weighted: they should nudge similarity, not drive it.
    if (token.length >= 4) {
      for (const gram of trigrams(token)) {
        const gramHash = hashFeature(gram, 0x9e3779b9)
        const gramIndex = gramHash % EMBEDDING_DIM
        const gramSign = (gramHash & 1) === 0 ? 1 : -1
        vector[gramIndex] = (vector[gramIndex] ?? 0) + gramSign * 0.18
      }
    }
  }

  // L2 normalise so cosine similarity reduces to a dot product.
  let magnitude = 0
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    const value = vector[i] ?? 0
    magnitude += value * value
  }
  magnitude = Math.sqrt(magnitude)
  if (magnitude > 0) {
    for (let i = 0; i < EMBEDDING_DIM; i++) {
      vector[i] = (vector[i] ?? 0) / magnitude
    }
  }

  return vector
}

/** Both vectors are expected unit-length, so this is the cosine directly. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0
  const length = Math.min(a.length, b.length)
  for (let i = 0; i < length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0)
  }
  // Clamp: floating point can push a self-similarity fractionally past 1.
  return Math.max(0, Math.min(1, dot))
}

/**
 * A flat vector index. Exhaustive scan — correct and fast enough well past
 * 50,000 vectors at 256 dimensions. The Postgres driver uses an `ivfflat`
 * index instead, which trades exactness for sublinear lookup.
 */
export class VectorIndex {
  private readonly vectors = new Map<string, Float32Array>()

  add(id: string, vector: Float32Array): void {
    this.vectors.set(id, vector)
  }

  get(id: string): Float32Array | undefined {
    return this.vectors.get(id)
  }

  get size(): number {
    return this.vectors.size
  }

  /** Similarity of every candidate against the query vector. */
  search(query: Float32Array, candidateIds?: ReadonlySet<string>): Map<string, number> {
    const scores = new Map<string, number>()
    for (const [id, vector] of this.vectors) {
      if (candidateIds && !candidateIds.has(id)) continue
      scores.set(id, cosineSimilarity(query, vector))
    }
    return scores
  }
}
