import 'server-only'
import type { SearchIntent } from '@/lib/domain/search'

/**
 * Conversational-turn detection, shared by both providers.
 *
 * The rule that keeps this safe: a message is treated as conversation ONLY
 * when it matches a small lexicon of greetings and meta questions AND the
 * intent parser found no product structure in it. "hi, I need a DN50 valve"
 * parses with a category and a spec, so it searches; a bare "hi" does not, so
 * it chats. When in doubt, search — a greeting answered with products is
 * clumsy, but a requirement answered with small talk loses the buyer.
 */

export type ConversationalKind =
  | 'greeting'
  | 'wellbeing'
  | 'thanks'
  | 'farewell'
  | 'capability'
  | 'identity'

const PATTERNS: [ConversationalKind, RegExp][] = [
  // Anchored at the start so "hello" fires but "shell oil filter" never does.
  ['greeting', /^(?:hi+|hey+|hello+|yo|howdy|namaste|namaskar|greetings|good\s+(?:morning|afternoon|evening|day))\b/],
  ['wellbeing', /^(?:how\s+are\s+you|how'?s\s+it\s+going|how\s+is\s+it\s+going|what'?s\s+up|wassup|sup|how\s+do\s+you\s+do)\b/],
  ['thanks', /^(?:thanks?|thank\s+you|thx|tysm|ty|much\s+appreciated|great,?\s+thanks?|perfect,?\s+thanks?)\b/],
  ['farewell', /^(?:bye|goodbye|good\s+night|see\s+you|see\s+ya|cya|take\s+care|that'?s\s+all)\b/],
  [
    'capability',
    /^(?:help|what\s+can\s+you\s+do|what\s+do\s+you\s+do|how\s+do(?:es)?\s+(?:you|this|it)\s+work|how\s+to\s+use\s+(?:this|you)|what\s+is\s+this|what\s+can\s+i\s+(?:ask|do)\s*(?:here|you)?)\??$/,
  ],
  ['identity', /^(?:who\s+are\s+you|are\s+you\s+(?:a\s+)?(?:bot|robot|human|real|ai)|what\s+are\s+you|what'?s\s+your\s+name)\b/],
]

/**
 * Lexicon check only — the caller must also confirm the parsed intent is
 * structureless before treating the message as conversation.
 */
export function matchConversational(query: string): ConversationalKind | null {
  const text = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (text.length === 0 || text.length > 120) return null

  for (const [kind, pattern] of PATTERNS) {
    if (pattern.test(text)) return kind
  }
  return null
}

/**
 * True when the parser extracted nothing a search could act on. Residual
 * keywords alone do not count as structure — "hi" leaves the keyword `hi` —
 * but more than a few of them means a real sentence we failed to parse, and
 * that belongs in the search engine, not in small talk.
 */
export function isStructureless(intent: SearchIntent): boolean {
  return (
    intent.categoryKeys.length === 0 &&
    intent.brandKeys.length === 0 &&
    intent.specs.length === 0 &&
    intent.applications.length === 0 &&
    intent.industries.length === 0 &&
    intent.price.min == null &&
    intent.price.max == null &&
    intent.quantity == null &&
    !intent.requiresInStock &&
    intent.excludedTerms.length === 0 &&
    intent.keywords.length <= 6
  )
}

/* -------------------------------------------------------------------------- */
/* Offline replies                                                            */
/* -------------------------------------------------------------------------- */

const EXAMPLE = '“stainless threaded ball valve for a chilled water riser, under ₹5,000”'

const REPLIES: Record<ConversationalKind, string[]> = {
  greeting: [
    `Hello! I'm the Sourcely assistant. Describe what you need to source — the duty, the size, the material, the budget — and I'll search the catalogue and explain every match. Something like ${EXAMPLE} works well.`,
    `Hi there. Tell me what you're trying to source and I'll work through the catalogue for you. You don't need the exact part name — what it has to do and where it goes is enough. For example: ${EXAMPLE}.`,
  ],
  wellbeing: [
    `Doing well, and ready to dig through the catalogue. What do you need to source today? Describe the duty and any constraints — size, material, budget — and I'll rank the matches and explain each one.`,
  ],
  thanks: [
    `Happy to help. If another requirement comes up — or you want me to compare the products you've shortlisted — just describe it here.`,
  ],
  farewell: [
    `Good luck with the project. Come back when the next requirement lands — describing the duty and budget is all it takes.`,
  ],
  capability: [
    `I turn a plain-language requirement into a ranked product search. Describe what you need — e.g. ${EXAMPLE} — and I'll parse it into filters you can see and edit, search the catalogue, and explain why each result matches, including where it falls short. You can refine with follow-up answers, remove any filter chip I got wrong, shortlist products, and raise an RFQ from the shortlist.`,
  ],
  identity: [
    `I'm the Sourcely sourcing assistant. I read industrial requirements written in plain language, turn them into specification filters, and rank the catalogue against them — showing my reasoning for every match. Tell me what you need to source and I'll get to work.`,
  ],
}

function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Deterministic canned reply — same message, same answer, testable. */
export function conversationalReply(kind: ConversationalKind, query: string): string {
  const options = REPLIES[kind]
  return options[hashString(query.trim().toLowerCase()) % options.length] as string
}
