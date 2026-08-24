'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import Link from 'next/link'
import {
  ArrowUp,
  Bookmark,
  CornerDownLeft,
  Columns3,
  FileText,
  History,
  Loader2,
  MessageSquarePlus,
  Sparkles,
  Trash2,
  User,
  WifiOff,
} from 'lucide-react'
import type {
  AssistantMessage,
  FollowUpQuestion,
  IntentChip,
} from '@/lib/domain/search'
import { cn } from '@/lib/cn'
import { pluralize } from '@/lib/format'
import { Chip } from '@/components/ui/badge'
import { Button, ButtonLink } from '@/components/ui/button'
import { InlineError } from '@/components/ui/states'
import { useShortlist } from '@/components/catalog/shortlist'
import { AssistantResultCard } from './result-card'
import { STARTER_PROMPTS, type StarterPrompt } from './starters'

/**
 * The assistant workspace.
 *
 * Three columns on desktop — history, conversation, and the resolved
 * specification — because the value of this surface is not the chat. It is
 * that the buyer can see what was understood and correct it. A single-column
 * chat hides the structure, which is the one thing that separates this from a
 * search box that talks.
 */

interface TurnResponse {
  conversationId: string
  userMessage: AssistantMessage
  assistantMessage: AssistantMessage
  chips: IntentChip[]
  provider: 'offline' | 'claude'
  providerConfigured: boolean
}

type Action =
  | { kind: 'ask'; query: string }
  | { kind: 'answer'; field: string; value: string }
  | { kind: 'remove-chip'; chipId: string }

/** Stages shown while a turn is in flight. Named after what actually happens. */
const THINKING_STAGES = [
  'Reading the requirement',
  'Resolving specifications',
  'Searching the catalogue',
  'Ranking by specification fit',
] as const

export interface WorkspaceProps {
  initialQuery: string
  signedIn: boolean
  catalogueSize: number
  savedSearchCount: number
}

export function AssistantWorkspace({
  initialQuery,
  signedIn,
  catalogueSize,
}: WorkspaceProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [chips, setChips] = useState<IntentChip[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [provider, setProvider] = useState<'offline' | 'claude'>('offline')
  const [pending, setPending] = useState(false)
  const [stage, setStage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)

  const threadRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const startedInitial = useRef(false)
  const { saved, compare } = useShortlist()

  /* --- Turn ------------------------------------------------------------- */

  const send = useCallback(
    async (action: Action) => {
      setPending(true)
      setError(null)
      setStage(0)

      try {
        const response = await fetch('/api/assistant/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...action, conversationId }),
        })

        if (response.status === 429) {
          const payload = (await response.json()) as { message?: string }
          setError(payload.message ?? 'Too many requests. Try again shortly.')
          return
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null
          setError(payload?.message ?? 'That search did not go through. Try again.')
          return
        }

        const payload = (await response.json()) as TurnResponse

        setConversationId(payload.conversationId)
        setProvider(payload.provider)
        setChips(payload.chips)
        setMessages((current) => [...current, payload.userMessage, payload.assistantMessage])
      } catch {
        setError(
          'Could not reach the server. Check your connection — nothing you typed has been lost.'
        )
      } finally {
        setPending(false)
      }
    },
    [conversationId]
  )

  /* --- Progress stages -------------------------------------------------- */

  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => {
      setStage((current) => Math.min(current + 1, THINKING_STAGES.length - 1))
    }, 420)
    return () => clearInterval(timer)
  }, [pending])

  /* --- Autoscroll ------------------------------------------------------- */

  useEffect(() => {
    if (messages.length === 0) return
    threadRef.current?.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, pending])

  /* --- Deep link -------------------------------------------------------- */

  useEffect(() => {
    if (startedInitial.current) return
    startedInitial.current = true
    if (initialQuery.trim()) void send({ kind: 'ask', query: initialQuery.trim() })
  }, [initialQuery, send])

  /* --- Composer --------------------------------------------------------- */

  function submit(event: FormEvent) {
    event.preventDefault()
    const query = draft.trim()
    if (!query || pending) return
    setDraft('')
    void send({ kind: 'ask', query })
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter breaks the line. A textarea that sends on every
    // Enter makes multi-line requirements impossible to type.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      const query = draft.trim()
      if (!query || pending) return
      setDraft('')
      void send({ kind: 'ask', query })
    }
  }

  function startFresh() {
    setMessages([])
    setChips([])
    setConversationId(null)
    setError(null)
    setDraft('')
    composerRef.current?.focus()
  }

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant') ?? null,
    [messages]
  )

  const results = lastAssistant?.results ?? []
  const empty = messages.length === 0 && !pending

  return (
    <div className="grid min-h-[calc(100dvh-4rem)] grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)_19rem]">
      {/* ── History rail ─────────────────────────────────────────────── */}
      <aside
        className={cn(
          'border-border lg:block lg:border-r',
          historyOpen ? 'block border-b' : 'hidden'
        )}
        aria-label="Conversation"
      >
        <div className="sticky top-16 p-4">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={startFresh}
            leadingIcon={<MessageSquarePlus className="size-4" aria-hidden />}
          >
            New requirement
          </Button>

          <div className="mt-6">
            <h2 className="mb-2.5 px-1 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
              Try one of these
            </h2>
            <ul className="space-y-1">
              {STARTER_PROMPTS.map((starter: StarterPrompt) => (
                <li key={starter.label}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void send({ kind: 'ask', query: starter.query })}
                    className="w-full rounded-md px-2.5 py-2 text-left text-[12.5px] leading-snug text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:opacity-50"
                  >
                    {starter.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {signedIn && (
            <div className="mt-6 border-t border-border pt-4">
              <Link
                href="/account/assistant"
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <History className="size-3.5" aria-hidden />
                Past conversations
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* ── Conversation ─────────────────────────────────────────────── */}
      <section className="flex min-w-0 flex-col" aria-label="Assistant conversation">
        {/* Mobile controls */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 lg:hidden">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setHistoryOpen((open) => !open)}
            leadingIcon={<Sparkles className="size-3.5" aria-hidden />}
          >
            Examples
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={startFresh}
            leadingIcon={<Trash2 className="size-3.5" aria-hidden />}
          >
            Clear
          </Button>
          {chips.length > 0 && (
            <span className="ml-auto font-mono text-[11px] text-faint tnum">
              {chips.length} filters
            </span>
          )}
        </div>

        <div
          ref={threadRef}
          className="min-h-0 flex-1 overflow-y-auto scrollbar-slim"
          role="log"
          aria-live="polite"
          aria-label="Conversation messages"
        >
          <div className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
            {empty ? (
              <EmptyState catalogueSize={catalogueSize} onPick={(query) => void send({ kind: 'ask', query })} />
            ) : (
              <ol className="space-y-6">
                {messages.map((message) => (
                  <li key={message.id}>
                    {message.role === 'user' ? (
                      <UserBubble content={message.content} />
                    ) : (
                      <AssistantTurn
                        message={message}
                        onAnswer={(field, value) => void send({ kind: 'answer', field, value })}
                        pending={pending}
                      />
                    )}
                  </li>
                ))}
              </ol>
            )}

            {pending && <ThinkingIndicator stage={stage} />}

            {error && (
              <InlineError
                message={error}
                className="mt-6"
                onRetry={() => {
                  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
                  if (lastUser) void send({ kind: 'ask', query: lastUser.content })
                }}
              />
            )}
          </div>
        </div>

        {/* Composer ------------------------------------------------------- */}
        <div className="border-t border-border bg-bg/85 px-4 py-4 backdrop-blur-xl md:px-6">
          <form onSubmit={submit} className="mx-auto max-w-3xl">
            <div className="relative rounded-xl border border-border bg-surface transition-colors focus-within:border-accent-line">
              <textarea
                ref={composerRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                maxLength={1000}
                disabled={pending}
                aria-label="Describe what you need"
                placeholder="Describe what you need — “stainless valve, DN50, under ₹5,000”"
                className="w-full resize-none bg-transparent px-4 py-3 pr-14 text-[15px] leading-relaxed text-text placeholder:text-faint focus:outline-none disabled:opacity-60"
              />

              <button
                type="submit"
                disabled={pending || draft.trim().length === 0}
                aria-label="Send"
                className={cn(
                  'absolute right-2.5 bottom-2.5 grid size-9 place-items-center rounded-lg transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  draft.trim().length > 0 && !pending
                    ? 'bg-accent text-accent-ink hover:bg-accent-hover'
                    : 'bg-surface-3 text-faint'
                )}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <ArrowUp className="size-4" aria-hidden />
                )}
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3 px-1">
              <p className="flex items-center gap-1.5 text-[11px] text-faint">
                <CornerDownLeft className="size-3" aria-hidden />
                Enter to send · Shift + Enter for a new line
              </p>

              {provider === 'offline' && messages.length > 0 && (
                <p className="flex items-center gap-1.5 text-[11px] text-muted" title="No language model is configured, so the ranking engine is running on its own. Specification matching is unaffected.">
                  <WifiOff className="size-3" aria-hidden />
                  Offline engine
                </p>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* ── Specification rail ───────────────────────────────────────── */}
      <aside
        className="hidden border-l border-border lg:block"
        aria-label="Resolved specification"
      >
        <div className="sticky top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto p-4 scrollbar-slim">
          <h2 className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
            Understood as
          </h2>

          {chips.length === 0 ? (
            <p className="text-[12.5px] leading-relaxed text-muted">
              Filters appear here as the assistant works out what you need. Remove
              any it gets wrong and the ranking recalculates.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <Chip
                    key={chip.id}
                    qualifier={chip.qualifier}
                    confidence={chip.confidence}
                    onRemove={
                      chip.removable && !pending
                        ? () => void send({ kind: 'remove-chip', chipId: chip.id })
                        : undefined
                    }
                    removeLabel={`Remove ${chip.qualifier ?? 'filter'} ${chip.label}`}
                  >
                    {chip.label}
                  </Chip>
                ))}
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-faint">
                A dashed border means the assistant inferred it rather than being told.
              </p>
            </>
          )}

          {/* Result summary --------------------------------------------- */}
          {results.length > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <h2 className="mb-3 text-[11px] font-semibold tracking-[0.12em] text-faint uppercase">
                This search
              </h2>
              <dl className="space-y-2 text-[12.5px]">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Ranked</dt>
                  <dd className="font-mono text-text tnum">{results.length}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Best match</dt>
                  <dd className="font-mono text-accent-text tnum">
                    {results[0]?.explanation.matchPercent ?? 0}%
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">In stock</dt>
                  <dd className="font-mono text-text tnum">
                    {results.filter((r) => r.product.availability.state === 'in_stock').length}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Actions ----------------------------------------------------- */}
          <div className="mt-6 space-y-2 border-t border-border pt-5">
            {compare.length >= 2 && (
              <ButtonLink
                href="/compare"
                variant="secondary"
                size="sm"
                fullWidth
                leadingIcon={<Columns3 className="size-3.5" aria-hidden />}
              >
                Compare {compare.length}
              </ButtonLink>
            )}

            {saved.length > 0 && (
              <>
                <ButtonLink
                  href="/account/saved"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  leadingIcon={<Bookmark className="size-3.5" aria-hidden />}
                >
                  Shortlist ({saved.length})
                </ButtonLink>
                <ButtonLink
                  href={`/account/rfq/new?product=${saved.slice(0, 20).join(',')}`}
                  size="sm"
                  fullWidth
                  leadingIcon={<FileText className="size-3.5" aria-hidden />}
                >
                  Request quotation
                </ButtonLink>
              </>
            )}

            {!signedIn && messages.length > 0 && (
              <p className="text-[11px] leading-relaxed text-faint">
                <Link href="/login" className="text-accent-text hover:underline">
                  Sign in
                </Link>{' '}
                to keep this conversation and your shortlist.
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex flex-row-reverse gap-3">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface-2 text-muted"
        aria-hidden
      >
        <User className="size-4" />
      </span>
      <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-accent px-4 py-2.5 text-[14px] leading-relaxed text-accent-ink">
        <span className="sr-only">You said: </span>
        {content}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function AssistantTurn({
  message,
  onAnswer,
  pending,
}: {
  message: AssistantMessage
  onAnswer: (field: string, value: string) => void
  pending: boolean
}) {
  const results = message.results ?? []

  return (
    <div className="flex gap-3">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full border border-accent-line bg-accent-soft text-accent-text"
        aria-hidden
      >
        <Sparkles className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="rounded-xl rounded-tl-sm border border-border bg-surface-2 px-4 py-3">
          <span className="sr-only">Assistant said: </span>
          <p className="text-[14px] leading-relaxed text-text-2">{message.content}</p>
        </div>

        {/* Results ------------------------------------------------------ */}
        {results.length > 0 && (
          <>
            <p className="mt-4 mb-2.5 px-1 text-[11px] font-semibold tracking-wide text-faint uppercase">
              {pluralize(results.length, 'result')} · ranked by specification fit
            </p>
            <div className="space-y-2.5">
              {results.map((result, index) => (
                <AssistantResultCard
                  key={result.product.id}
                  result={result}
                  rank={index + 1}
                  query={message.intent?.rawQuery ?? ''}
                />
              ))}
            </div>
          </>
        )}

        {/* Follow-up ---------------------------------------------------- */}
        {message.followUp && (
          <FollowUpChips followUp={message.followUp} onAnswer={onAnswer} disabled={pending} />
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The follow-up rendered as tappable chips, not a text prompt.
 *
 * On mobile this is the difference between one thumb tap and typing a
 * specification into a phone keyboard, which is where these conversations
 * otherwise end.
 */
function FollowUpChips({
  followUp,
  onAnswer,
  disabled,
}: {
  followUp: FollowUpQuestion
  onAnswer: (field: string, value: string) => void
  disabled: boolean
}) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-accent-line bg-accent-soft/30 p-4">
      <p className="text-[13px] font-medium text-text">{followUp.question}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {followUp.options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(followUp.field, option.value)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[12.5px] font-medium text-text transition-colors hover:border-accent-line hover:bg-accent-soft disabled:opacity-50"
          >
            {option.label}
            {option.resultCount != null && (
              <span className="font-mono text-[10px] text-faint tnum">{option.resultCount}</span>
            )}
          </button>
        ))}
      </div>

      {followUp.skippable && (
        <p className="mt-2.5 text-[11px] text-faint">
          Or keep typing — answering is optional.
        </p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function ThinkingIndicator({ stage }: { stage: number }) {
  return (
    <div className="mt-6 flex gap-3">
      <span
        className="grid size-8 shrink-0 place-items-center rounded-full border border-accent-line bg-accent-soft text-accent-text"
        aria-hidden
      >
        <Sparkles className="size-4 animate-pulse" />
      </span>

      <div className="flex items-center gap-2.5 rounded-xl rounded-tl-sm border border-border bg-surface-2 px-4 py-3">
        <Loader2 className="size-3.5 animate-spin text-accent" aria-hidden />
        <span className="text-[13px] text-muted" aria-live="polite">
          {THINKING_STAGES[stage]}…
        </span>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

function EmptyState({
  catalogueSize,
  onPick,
}: {
  catalogueSize: number
  onPick: (query: string) => void
}) {
  return (
    <div className="py-8 text-center md:py-16">
      <span
        className="mx-auto grid size-14 place-items-center rounded-2xl border border-accent-line bg-accent-soft text-accent-text"
        aria-hidden
      >
        <Sparkles className="size-6" />
      </span>

      <h1 className="mt-6 font-display text-2xl leading-tight font-semibold tracking-tight md:text-3xl">
        What do you need to source?
      </h1>

      <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-muted">
        Describe it the way you would to a colleague. You do not need the part
        name — tell me what it has to do and where it goes, and I will work
        through {pluralize(catalogueSize, 'product')} and explain every match.
      </p>

      <div className="mx-auto mt-8 grid max-w-2xl gap-2 sm:grid-cols-2">
        {STARTER_PROMPTS.slice(0, 4).map((starter) => (
          <button
            key={starter.label}
            type="button"
            onClick={() => onPick(starter.query)}
            className="group rounded-xl border border-border bg-surface p-4 text-left transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent-line"
          >
            <p className="text-[10px] font-semibold tracking-wider text-accent-text uppercase">
              {starter.category}
            </p>
            <p className="mt-1.5 text-[13.5px] leading-snug text-text">{starter.label}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
