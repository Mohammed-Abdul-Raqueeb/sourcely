'use server'

import { revalidatePath } from 'next/cache'
import { getActivityRepository, getCatalogRepository } from '@/server/repositories'
import { getSession, getVisitorId, requireUser } from '@/server/auth/session'

/**
 * Buyer activity server actions.
 *
 * Every one of these resolves the caller's user id from the session and passes
 * it to a repository method that scopes by it. No action accepts a user id
 * from the client — that would make every one of them an IDOR.
 */

/* -------------------------------------------------------------------------- */
/* Shortlist                                                                  */
/* -------------------------------------------------------------------------- */

export interface ToggleResult {
  saved: boolean
  /** Present when the caller is signed out and the change was not persisted. */
  requiresAuth?: boolean
}

/**
 * Toggles a product in the signed-in buyer's shortlist.
 *
 * Signed-out callers get `requiresAuth` rather than an error: the client-side
 * shortlist still works for them, and the UI prompts to sign in to keep it.
 */
export async function toggleSavedAction(productId: string): Promise<ToggleResult> {
  const session = await getSession()
  if (!session) return { saved: false, requiresAuth: true }

  // Reject ids that do not resolve, so the store cannot be filled with junk.
  const product = await getCatalogRepository().findById(productId)
  if (!product) return { saved: false }

  const activity = getActivityRepository()
  const alreadySaved = await activity.isSaved(session.user.id, productId)

  if (alreadySaved) {
    await activity.unsaveProduct(session.user.id, productId)
  } else {
    await activity.saveProduct(session.user.id, productId)
  }

  revalidatePath('/account/saved')
  revalidatePath('/account')
  return { saved: !alreadySaved }
}

export async function setSavedNoteAction(
  productId: string,
  note: string
): Promise<{ ok: boolean }> {
  const session = await getSession()
  if (!session) return { ok: false }

  await getActivityRepository().setSavedNote(
    session.user.id,
    productId,
    note.trim().slice(0, 400) || null
  )

  revalidatePath('/account/saved')
  return { ok: true }
}

/**
 * Merges an anonymous shortlist into the account on sign-in.
 *
 * Called by the client once, right after authentication, with whatever the
 * browser had in `localStorage`. Without this the shortlist a visitor built
 * while evaluating evaporates at the login wall.
 */
export async function mergeShortlistAction(
  productIds: string[]
): Promise<{ merged: number }> {
  const session = await getSession()
  if (!session) return { merged: 0 }

  const catalog = getCatalogRepository()
  const activity = getActivityRepository()

  // Bounded so a crafted payload cannot make this loop forever.
  const candidates = productIds.slice(0, 100)
  let merged = 0

  for (const productId of candidates) {
    if (await activity.isSaved(session.user.id, productId)) continue
    if (!(await catalog.findById(productId))) continue
    await activity.saveProduct(session.user.id, productId)
    merged++
  }

  if (merged > 0) {
    revalidatePath('/account/saved')
    revalidatePath('/account')
  }

  return { merged }
}

/* -------------------------------------------------------------------------- */
/* Saved searches                                                             */
/* -------------------------------------------------------------------------- */

export async function saveSearchAction(input: {
  title: string
  query: string
}): Promise<{ ok: boolean; id?: string }> {
  const session = await getSession()
  if (!session) return { ok: false }

  const saved = await getActivityRepository().saveSearch({
    userId: session.user.id,
    title: input.title.trim().slice(0, 120) || input.query.slice(0, 120),
    query: input.query.trim().slice(0, 500),
    intent: null,
    alertsEnabled: false,
    lastResultCount: 0,
  })

  revalidatePath('/account/searches')
  return { ok: true, id: saved.id }
}

export async function deleteSavedSearchAction(id: string): Promise<void> {
  const user = await requireUser()
  await getActivityRepository().deleteSavedSearch(user.id, id)
  revalidatePath('/account/searches')
}

export async function toggleSearchAlertsAction(
  id: string,
  enabled: boolean
): Promise<void> {
  const user = await requireUser()
  await getActivityRepository().setSearchAlerts(user.id, id, enabled)
  revalidatePath('/account/searches')
}

export async function clearSearchHistoryAction(): Promise<void> {
  const user = await requireUser()
  await getActivityRepository().clearSearchHistory(user.id)
  revalidatePath('/account/searches')
  revalidatePath('/account')
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export async function markNotificationReadAction(id: string): Promise<void> {
  const user = await requireUser()
  await getActivityRepository().markNotificationRead(user.id, id)
  revalidatePath('/account/notifications')
  revalidatePath('/account', 'layout')
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser()
  await getActivityRepository().markAllNotificationsRead(user.id)
  revalidatePath('/account/notifications')
  revalidatePath('/account', 'layout')
}

/* -------------------------------------------------------------------------- */
/* Product views                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Records that a product page was opened.
 *
 * Fired from the client after paint (see `ViewTracker` on the product page)
 * rather than during render: a server component cannot write, and the product
 * page is statically prerendered — code in its render never runs per-request
 * in production. An action invoked from the browser runs at request time
 * regardless of how the page's HTML was produced.
 *
 * The visitor id is resolved here, not passed in: the cookie is httpOnly by
 * design, so the browser cannot read it — and an id supplied by the client
 * would be attacker-chosen anyway.
 */
export async function recordViewAction(productId: string): Promise<void> {
  const [session, visitorId, product] = await Promise.all([
    getSession(),
    getVisitorId(),
    getCatalogRepository().findById(productId),
  ])
  if (!product) return

  await getActivityRepository().recordView(session?.user.id ?? null, visitorId, productId)
}
