import type { Metadata } from 'next'
import { getCurrentUser } from '@/server/auth/session'
import { getActivityRepository, getCatalogRepository } from '@/server/repositories'
import { AssistantWorkspace } from '@/components/assistant/workspace'

export const metadata: Metadata = {
  title: 'AI Assistant',
  description:
    'Describe what you need in plain language. Sourcely resolves it into a specification, ranks the catalogue against it, and explains every match.',
}

/**
 * The assistant workspace.
 *
 * A thin server shell: it resolves the session and the catalogue size, then
 * hands off to a client component. The conversation itself runs through
 * /api/assistant/query so a turn is one round trip rather than a full
 * server-component re-render.
 */
export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const [{ q }, user] = await Promise.all([searchParams, getCurrentUser()])

  const stats = await getCatalogRepository().stats()
  const savedSearches = user
    ? await getActivityRepository().listSavedSearches(user.id)
    : []

  return (
    <AssistantWorkspace
      initialQuery={q ?? ''}
      signedIn={Boolean(user)}
      catalogueSize={stats.products}
      savedSearchCount={savedSearches.length}
    />
  )
}
