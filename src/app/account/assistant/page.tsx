import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, MessageSquare, Sparkles } from 'lucide-react'
import { requireUser } from '@/server/auth/session'
import { getActivityRepository } from '@/server/repositories'
import { formatRelative, pluralize, truncate } from '@/lib/format'
import { ButtonLink } from '@/components/ui/button'
import { StateBlock } from '@/components/ui/states'
import { PageHeader, SectionCard } from '@/components/account/ui'

export const metadata: Metadata = { title: 'Conversations' }

/**
 * Assistant conversation history.
 *
 * Each row shows the requirement and what the last turn actually returned, so
 * the list is scannable without opening anything — a history of titles alone
 * tells a buyer nothing about which thread had the answer.
 */
export default async function ConversationsPage() {
  const user = await requireUser('/account/assistant')
  const conversations = await getActivityRepository().listConversations(user.id, 50)

  return (
    <>
      <PageHeader
        title="Conversations"
        description="Every requirement you have described to the assistant, with the results it produced."
        action={
          <ButtonLink href="/assistant" leadingIcon={<Sparkles className="size-4" aria-hidden />}>
            New requirement
          </ButtonLink>
        }
      />

      {conversations.length === 0 ? (
        <StateBlock
          title="No conversations yet"
          description="Describe a requirement to the assistant and the thread is kept here, with the ranking and the reasoning intact."
          primaryAction={{ label: 'Open the assistant', href: '/assistant' }}
          secondaryAction={{ label: 'Browse products', href: '/products' }}
        />
      ) : (
        <SectionCard
          title="All conversations"
          description={pluralize(conversations.length, 'thread')}
          padded={false}
        >
          <ul className="divide-y divide-border">
            {conversations.map((conversation) => {
              const lastAssistant = [...conversation.messages]
                .reverse()
                .find((message) => message.role === 'assistant')
              const resultCount = lastAssistant?.results?.length ?? 0
              const topMatch = lastAssistant?.results?.[0]

              return (
                <li key={conversation.id}>
                  <Link
                    href={`/assistant?q=${encodeURIComponent(conversation.title)}`}
                    className="group flex gap-3.5 px-5 py-4 transition-colors hover:bg-surface-2"
                  >
                    <span
                      className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-muted"
                      aria-hidden
                    >
                      <MessageSquare className="size-3.5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[14px] font-medium text-text">
                        {truncate(conversation.title, 78)}
                        <ArrowUpRight
                          className="size-3.5 shrink-0 text-faint transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </p>

                      {topMatch && (
                        <p className="mt-1 truncate text-[12.5px] text-muted">
                          Best match: {topMatch.product.name} ·{' '}
                          {topMatch.explanation.matchPercent}%
                        </p>
                      )}

                      <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-faint">
                        <span>{formatRelative(conversation.updatedAt)}</span>
                        <span className="font-mono tnum">
                          {pluralize(conversation.messages.length, 'message')}
                        </span>
                        {resultCount > 0 && (
                          <span className="font-mono tnum">{resultCount} results</span>
                        )}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </SectionCard>
      )}
    </>
  )
}
