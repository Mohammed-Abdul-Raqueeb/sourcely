import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getSession, getVisitorId } from '@/server/auth/session'
import { clientIdentifier, LIMITS, rateLimit } from '@/server/security/rate-limit'
import { runAssistantTurn } from '@/server/ai/assistant-service'
import { resolveProviderName } from '@/server/ai/provider'

/**
 * Assistant turn endpoint.
 *
 * The client never sends a `SearchIntent`. It sends an action — a question, a
 * follow-up answer, or a chip removal — and the server reads the previous
 * intent from the stored conversation. Accepting an intent from the client
 * would be accepting a search filter from the client, which in a multi-tenant
 * catalogue is a way to hand someone else's scoped view to a stranger.
 */

const bodySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ask'),
    query: z.string().trim().min(1, 'Ask something').max(1000),
    conversationId: z.string().max(64).nullish(),
  }),
  z.object({
    kind: z.literal('answer'),
    field: z.string().trim().min(1).max(64),
    value: z.string().trim().min(1).max(64),
    conversationId: z.string().max(64).nullish(),
  }),
  z.object({
    kind: z.literal('remove-chip'),
    chipId: z.string().trim().min(1).max(128),
    conversationId: z.string().max(64).nullish(),
  }),
])

export async function POST(request: NextRequest) {
  /* --- CSRF ------------------------------------------------------------- */
  const origin = request.headers.get('origin')
  if (origin) {
    const host = request.headers.get('host')
    try {
      if (!host || new URL(origin).host !== host) {
        return NextResponse.json({ error: 'Bad origin' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Bad origin' }, { status: 403 })
    }
  }

  /* --- Rate limit -------------------------------------------------------- */
  const session = await getSession()
  const identity = session ? `user:${session.user.id}` : `ip:${await clientIdentifier()}`
  const limit = await rateLimit(`assistant:${identity}`, LIMITS.assistant.limit, LIMITS.assistant.windowMs)

  if (!limit.ok) {
    return NextResponse.json(
      {
        error: 'rate_limited',
        message: `That is a lot of questions at once. Try again in ${limit.retryAfter} seconds.`,
        retryAfter: limit.retryAfter,
      },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  /* --- Parse ------------------------------------------------------------- */
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_request', issues: parsed.error.issues.map((issue) => issue.message) },
      { status: 400 }
    )
  }

  /* --- Run --------------------------------------------------------------- */
  const { conversationId, ...action } = parsed.data

  try {
    const result = await runAssistantTurn({
      action,
      conversationId: conversationId ?? null,
      userId: session?.user.id ?? null,
      visitorId: await getVisitorId(),
    })

    return NextResponse.json(
      {
        conversationId: result.conversationId,
        userMessage: result.userMessage,
        assistantMessage: result.assistantMessage,
        chips: result.chips,
        provider: result.provider,
        // Surfaced so the UI can say "running offline" honestly rather than
        // implying a language model wrote prose that a template did.
        providerConfigured: resolveProviderName() === result.provider,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('[assistant] turn failed:', error)
    return NextResponse.json(
      {
        error: 'server',
        message:
          'Something broke while searching. The error has been logged — try that again in a moment.',
      },
      { status: 500 }
    )
  }
}
