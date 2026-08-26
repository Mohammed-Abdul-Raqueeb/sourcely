import 'server-only'
import type {
  AssistantMessage,
  Conversation,
  IntentChip,
  SearchIntent,
} from '@/lib/domain/search'
import { getActivityRepository, getCatalogRepository } from '@/server/repositories'
import { getSpecDefinition, specEnumLabel } from '@/server/catalog/spec-registry'
import { intentToChips, removeChip } from './chips'
import { applyFollowUp, buildFollowUp } from './follow-up'
import { getAiProvider } from './provider'

/**
 * One assistant turn, end to end.
 *
 * parse → constrain → retrieve → score → diversify → follow-up → narrate
 *
 * The refinement rule that makes this feel like a conversation rather than a
 * series of searches: a follow-up answer or a removed chip refines the
 * *previous* intent, it does not re-parse from scratch. The previous intent is
 * read from the stored conversation, never accepted from the client — a
 * client-supplied intent is a client-supplied search filter, and this is a
 * multi-tenant catalogue.
 */

const RESULT_LIMIT = 12
/** How many prior turns the provider sees. Enough for pronouns, not the world. */
const HISTORY_WINDOW = 6

export type AssistantAction =
  | { kind: 'ask'; query: string }
  | { kind: 'answer'; field: string; value: string }
  | { kind: 'remove-chip'; chipId: string }

export interface AssistantTurnInput {
  action: AssistantAction
  conversationId: string | null
  userId: string | null
  visitorId: string
}

export interface AssistantTurnResult {
  conversationId: string
  userMessage: AssistantMessage
  assistantMessage: AssistantMessage
  chips: IntentChip[]
  provider: 'offline' | 'claude'
}

function messageId(): string {
  return `msg_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

/** The last intent this conversation produced, or null on a fresh thread. */
function lastIntent(conversation: Conversation | null): SearchIntent | null {
  if (!conversation) return null
  for (let i = conversation.messages.length - 1; i >= 0; i--) {
    const intent = conversation.messages[i]?.intent
    if (intent) return intent
  }
  return null
}

/** What the buyer's action reads as in the transcript. */
function describeAction(action: AssistantAction, intent: SearchIntent | null): string {
  switch (action.kind) {
    case 'ask':
      return action.query
    case 'answer': {
      // Registry labels, not underscore-stripping: the transcript should say
      // "Stainless Steel 316", the way every other surface does — falling back
      // to the stripped raw value only for a key the registry does not know.
      const fieldLabel = getSpecDefinition(action.field)?.label ?? action.field.replace(/_/g, ' ')
      if (action.value.includes(':')) {
        return `${fieldLabel}: ${action.value.replace(':', ' to ')}`
      }
      const valueLabel = specEnumLabel(action.field, action.value)
      return valueLabel === action.value ? action.value.replace(/_/g, ' ') : valueLabel
    }
    case 'remove-chip': {
      const chip = intent ? intentToChips(intent).find((entry) => entry.id === action.chipId) : null
      // "Not stainless steel" would be wrong: dropping a filter widens the
      // search, it does not exclude the value. The transcript has to say what
      // actually happened or the next turn reads as a contradiction.
      if (!chip) return 'Drop that filter'
      return chip.qualifier
        ? `Drop the ${chip.qualifier.toLowerCase()} filter (${chip.label})`
        : `Drop the ${chip.label} filter`
    }
  }
}

export async function runAssistantTurn(
  input: AssistantTurnInput
): Promise<AssistantTurnResult> {
  const started = performance.now()

  const catalog = getCatalogRepository()
  const activity = getActivityRepository()
  const provider = getAiProvider()

  /* --- Conversation ------------------------------------------------------ */

  let conversation = input.conversationId
    ? await activity.findConversation(input.userId, input.conversationId)
    : null

  const previous = lastIntent(conversation)

  const history = (conversation?.messages ?? [])
    .slice(-HISTORY_WINDOW)
    .map((message) => ({ role: message.role, content: message.content }))

  /* --- Intent ------------------------------------------------------------ */

  let intent: SearchIntent

  if (input.action.kind === 'ask') {
    // A fresh question is first read for what it is. A greeting or a "what
    // can you do" gets a conversational answer and never touches the search
    // engine; anything with product structure flows through the pipeline
    // unchanged. See provider.interpret / conversation.ts for the rule.
    const interpretation = await provider.interpret(input.action.query, history)

    if (interpretation.kind === 'chat') {
      const now = new Date().toISOString()

      const userMessage: AssistantMessage = {
        id: messageId(),
        role: 'user',
        content: input.action.query,
        createdAt: now,
      }

      // Content-only: no intent, results or follow-up. The client renders it
      // as a plain bubble, which is exactly what a greeting should be.
      const assistantMessage: AssistantMessage = {
        id: messageId(),
        role: 'assistant',
        content: interpretation.reply,
        createdAt: now,
        followUp: null,
        error: null,
      }

      conversation ??= await activity.createConversation(input.userId, 'New conversation')
      await activity.appendMessages(conversation.id, [userMessage, assistantMessage])

      // Deliberately no recordSearch: nothing was searched, and a "hi" must
      // not show up in the admin search-analytics as a zero-result query.
      return {
        conversationId: conversation.id,
        userMessage,
        assistantMessage,
        // The client replaces its chip rail with this every turn — echo the
        // previous intent's chips so small talk does not wipe the built-up
        // specification.
        chips: previous ? intentToChips(previous) : [],
        provider: provider.name,
      }
    }

    intent = interpretation.intent
  } else if (previous) {
    // Refinements operate on what we already understood, so the buyer is
    // adding to a specification rather than restating it.
    intent =
      input.action.kind === 'answer'
        ? applyFollowUp(previous, input.action.field, input.action.value)
        : removeChip(previous, input.action.chipId)
  } else {
    // A refinement with no prior turn (a stale tab, a shared link). Nothing to
    // refine, so treat it as a fresh question rather than erroring.
    intent = await provider.parseIntent(describeAction(input.action, null), history)
  }

  /* --- Rank -------------------------------------------------------------- */

  const { results, total } = await catalog.rankByIntent(intent, RESULT_LIMIT)

  /* --- Follow-up --------------------------------------------------------- */

  const followUp = buildFollowUp(
    intent,
    results.map((result) => result.product)
  )

  /* --- Narrate ----------------------------------------------------------- */

  const prose = await provider.narrate({
    intent,
    results,
    totalMatches: total,
    followUp,
    history,
  })

  /* --- Persist ----------------------------------------------------------- */

  const now = new Date().toISOString()

  const userMessage: AssistantMessage = {
    id: messageId(),
    role: 'user',
    content: describeAction(input.action, previous),
    createdAt: now,
  }

  const assistantMessage: AssistantMessage = {
    id: messageId(),
    role: 'assistant',
    content: prose,
    createdAt: now,
    intent,
    results,
    followUp,
    totalMatches: total,
    error: total === 0 ? { kind: 'no_results', message: prose } : null,
  }

  conversation ??= await activity.createConversation(input.userId, 'New conversation')
  await activity.appendMessages(conversation.id, [userMessage, assistantMessage])

  // Analytics spine. Failing to record must never fail the search.
  void activity
    .recordSearch({
      userId: input.userId,
      sessionId: input.visitorId,
      query: intent.rawQuery || userMessage.content,
      mode: 'ai',
      intent,
      resultCount: total,
      clickedProductIds: [],
      convertedToRfq: false,
      tookMs: Math.round(performance.now() - started),
    })
    .catch(() => {})

  return {
    conversationId: conversation.id,
    userMessage,
    assistantMessage,
    chips: intentToChips(intent),
    provider: provider.name,
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Comparison prose for the assistant's compare action.
 *
 * Separate from the turn loop because it answers a different question — not
 * "what should I look at" but "how do these differ".
 */
export async function compareForAssistant(productIds: string[]): Promise<string> {
  const products = await getCatalogRepository().findManyByIds(productIds.slice(0, 4))
  return getAiProvider().compare(products)
}
