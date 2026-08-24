import { NextResponse } from 'next/server'
import { getSession } from '@/server/auth/session'
import { getActivityRepository } from '@/server/repositories'

/**
 * The signed-in buyer's shortlist ids, plus who they are.
 *
 * Exists so the marketing pages can stay statically generated while still
 * showing accurate per-user state: the page ships as static HTML and the
 * shortlist provider reconciles against this endpoint after mount. Making the
 * layout read the session instead would turn every product page dynamic for
 * the sake of two bookmark icons and a name in the header.
 *
 * Returns `saved: null` for signed-out callers — distinct from `[]`, which
 * means "signed in with an empty shortlist". The `user` object is display
 * data only (the caller's own name and role, never anyone else's); every
 * privileged surface still authorizes server-side via requireUser/requireRole.
 */
export async function GET() {
  const session = await getSession()

  if (!session) {
    return NextResponse.json(
      { saved: null, user: null },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const saved = await getActivityRepository().listSavedProducts(session.user.id)

  return NextResponse.json(
    {
      saved: saved.map((entry) => entry.productId),
      user: { name: session.user.name, role: session.user.role },
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
